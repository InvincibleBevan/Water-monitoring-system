from fastapi import FastAPI, Depends, WebSocket, WebSocketDisconnect, HTTPException, status, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
import asyncio
import json
import random
import os
from datetime import datetime
from dotenv import load_dotenv
try:
    from google import genai
    _GENAI_AVAILABLE = True
except Exception:
    genai = None
    _GENAI_AVAILABLE = False
from database import SessionLocal, engine, Base
import models
import schemas
try:
    from twilio.rest import Client
except Exception:
    Client = None
from passlib.context import CryptContext
try:
    import africastalking
    _AFRICA_TALKING_AVAILABLE = True
except Exception:
    africastalking = None
    _AFRICA_TALKING_AVAILABLE = False

# Load environment variables from .env file
load_dotenv()


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Maji AI API")

router = APIRouter()

# Serve the frontend static files (if the frontend folder exists alongside the backend folder)
from pathlib import Path
frontend_dir = Path(__file__).resolve().parent.parent / "frontend"
if frontend_dir.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dir), html=True), name="frontend")
else:
    print(f"Warning: frontend directory not found at {frontend_dir}")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize once
if _AFRICA_TALKING_AVAILABLE:
    try:
        africastalking.initialize(
            os.getenv("AFRICASTALKING_USERNAME"),
            os.getenv("AFRICASTALKING_API_KEY")
        )
        sms_service = africastalking.SMS
    except Exception:
        sms_service = None
else:
    sms_service = None

# Initialize GenAI Client if available
if _GENAI_AVAILABLE:
    try:
        os.environ.setdefault("GEMINI_API_KEY", "")
        ai_client = genai.Client()
    except Exception:
        ai_client = None
else:
    ai_client = None

AI_MODEL_URL = os.getenv("AI_MODEL_URL", "http://localhost:8001/predict")

async def get_ai_prediction(data: schemas.TelemetryCreate):
    try:
        import httpx
        async with httpx.AsyncClient() as client:
            payload = {
                "deviceId": "RiverStation01", # Placeholder device ID
                "pH": data.ph,
                "turbidity": data.turbidity,
                "temperature": data.temperature,
                "conductivity": data.conductivity
            }
            response = await client.post(AI_MODEL_URL, json=payload, timeout=5.0)
            if response.status_code == 200:
                return response.json()
    except Exception as e:
        print(f"AI Model prediction failed: {e}")
    return None

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def trigger_sms_alert(db_record):
    if sms_service is None:
        print("SMS service not available")
        return
    db = SessionLocal()
    try:
        users = db.query(models.User).all()
        recipients = [user.phone for user in users if user.phone]
        if not recipients:
            print("No phone numbers to send SMS to")
            return
        message = f"ALERT: Water contamination detected! pH: {db_record.ph:.2f}, Turbidity: {db_record.turbidity:.2f} NTU, Safety Score: {db_record.safety_score:.2f}"
        try:
            response = sms_service.send(message, recipients)
            print(f"SMS sent successfully: {response}")
        except Exception as e:
            print(f"Failed to send SMS: {e}")
    finally:
        db.close()

class AppState:
    def __init__(self):
        self.is_contaminated = False
        self.score = 98.0
        self.current_ph = 7.2
        self.current_tur = 1.5
        self.current_temp = 18.5
        self.current_cond = 350.0
        self.current_pathogens = 0.0
        self.contamination_start_time = None
        self.sms_sent = False

state = AppState()

# WebSocket Manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast_json(self, data: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(data)
            except Exception as e:
                pass

manager = ConnectionManager()



# Background task for simulating data and sending it to websockets
async def telemetry_loop():
    while True:
        # Get AI prediction every few seconds
        if int(datetime.now().timestamp()) % 10 == 0:
            ai_data = schemas.TelemetryCreate(
                ph=state.current_ph,
                turbidity=state.current_tur,
                temperature=state.current_temp,
                conductivity=state.current_cond,
                safety_score=state.score,
                pathogen_concentration=state.current_pathogens
            )
            prediction = await get_ai_prediction(ai_data)
            if prediction:
                state.current_ai_label = prediction.get("label")
                state.current_ai_score = prediction.get("risk_score")
                state.current_ai_anomaly = prediction.get("anomaly")

        # Data is now updated externally via POST /api/telemetry
        
        # Save to DB every 5 seconds (to avoid overwhelming SQLite)
        # But broadcast every second
        is_db_tick = int(datetime.now().timestamp()) % 5 == 0
        is_ai_tick = int(datetime.now().timestamp()) % 15 == 0
        
        if is_ai_tick and ai_client is not None:
            try:
                # Generate AI Insight asynchronously
                prompt = f"Water Telemetry: pH={state.current_ph}, Turbidity={state.current_tur} NTU, Temp={state.current_temp}C, Conductivity={state.current_cond} uS/cm. Pathogens={state.current_pathogens} CFU/100mL. Safety Score={state.score}/100. Provide a 1-sentence assessment of the safety."
                response = await asyncio.to_thread(
                    ai_client.models.generate_content,
                    model='gemini-2.5-flash',
                    contents=prompt
                )
                ai_data = {
                    "type": "ai_insight",
                    "insight": response.text,
                    "safety_score": state.score
                }
                if manager.active_connections:
                    await manager.broadcast_json(ai_data)
            except Exception as e:
                print(f"AI Generation Failed: {e}")

        db_record = None
        if is_db_tick:
            db = SessionLocal()
            try:
                db_record = models.TelemetryData(
                    ph=state.current_ph,
                    turbidity=state.current_tur,
                    temperature=state.current_temp,
                    conductivity=state.current_cond,
                    is_contaminated=state.is_contaminated,
                    safety_score=state.score,
                    pathogen_concentration=state.current_pathogens,
                    ai_label=getattr(state, 'current_ai_label', None),
                    ai_score=getattr(state, 'current_ai_score', None),
                    ai_is_anomaly=getattr(state, 'current_ai_anomaly', None)
                )
                db.add(db_record)
                db.commit()
                db.refresh(db_record)
                
                # Check for SMS (if contamination drops score low for 30 seconds)
                if state.is_contaminated and state.score < 40:
                    if state.contamination_start_time is None:
                        state.contamination_start_time = datetime.now()
                    
                    elapsed = (datetime.now() - state.contamination_start_time).total_seconds()
                    if elapsed >= 30 and not state.sms_sent:
                        trigger_sms_alert(db_record)
                        state.sms_sent = True
                else:
                    state.contamination_start_time = None
                    state.sms_sent = False
            finally:
                db.close()

        data = {
            "type": "telemetry",
            "timestamp": datetime.now().isoformat(),
            "ph": state.current_ph,
            "turbidity": state.current_tur,
            "temperature": state.current_temp,
            "conductivity": state.current_cond,
            "safety_score": state.score,
            "is_contaminated": state.is_contaminated,
            "pathogen_concentration": state.current_pathogens,
            "ai_label": getattr(state, 'current_ai_label', "Awaiting AI..."),
            "ai_score": getattr(state, 'current_ai_score', 0.0),
            "ai_is_anomaly": getattr(state, 'current_ai_anomaly', False)
        }
        
        if manager.active_connections:
            await manager.broadcast_json(data)
        
        await asyncio.sleep(1)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(telemetry_loop())

@app.websocket("/ws/telemetry")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # We just need to keep the connection open
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.get("/api/history", response_model=list[schemas.TelemetryDataSchema])
def get_history(limit: int = 100, db: Session = Depends(get_db)):
    # Get latest records ordered by timestamp descending, then reverse them
    records = db.query(models.TelemetryData).order_by(models.TelemetryData.timestamp.desc()).limit(limit).all()
    records.reverse()
    return records

@app.post("/api/simulate-issue")
def simulate_issue():
    state.is_contaminated = True
    return {"status": "success", "message": "Contamination simulated"}

@app.post("/api/resolve-issue")
def resolve_issue():
    state.is_contaminated = False
    return {"status": "success", "message": "Contamination resolved"}

@app.post("/api/telemetry")
def receive_telemetry(data: schemas.TelemetryCreate):
    state.current_ph = data.ph
    state.current_tur = data.turbidity
    state.current_temp = data.temperature
    state.current_cond = data.conductivity
    state.score = data.safety_score
    state.current_pathogens = data.pathogen_concentration
    
    # We'll let the background loop handle AI prediction for consistency,
    # or we can update it here if we want immediate feedback.
    # For now, let's keep it simple.
    
    # Return whether the system is in an active simulation issue mode
    # so the sensor script can adjust its generation
    return {"status": "success", "is_contaminated": state.is_contaminated}

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

@app.post("/api/register", response_model=schemas.UserResponse)
def register_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
        
    hashed_password = get_password_hash(user.password)
    new_user = models.User(
        name=user.name,
        email=user.email,
        phone=user.phone,
        password_hash=hashed_password
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.post("/api/login")
def login(user: schemas.UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if not db_user or not verify_password(user.password, db_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    return {
        "message": "Login successful",
        "user": {
            "id": db_user.id,
            "name": db_user.name,
            "email": db_user.email,
            "phone": db_user.phone
        }
    }
