const valPh = document.getElementById('val-ph');
const progPh = document.getElementById('prog-ph');
const trendPh = document.getElementById('trend-ph');

const valTur = document.getElementById('val-tur');
const progTur = document.getElementById('prog-tur');
const trendTur = document.getElementById('trend-tur');

const valTemp = document.getElementById('val-temp');
const progTemp = document.getElementById('prog-temp');
const trendTemp = document.getElementById('trend-temp');

const valCond = document.getElementById('val-cond');
const progCond = document.getElementById('prog-cond');
const trendCond = document.getElementById('trend-cond');

const valRisk = document.getElementById('val-risk');
const progRisk = document.getElementById('prog-risk');
const trendRisk = document.getElementById('trend-risk');

const valPuri = document.getElementById('val-puri');
const progPuri = document.getElementById('prog-puri');
const trendPuri = document.getElementById('trend-puri');

const safetyScore = document.getElementById('safety-score');
const aiStatusPanel = document.getElementById('ai-status-panel');
const systemIndicator = document.getElementById('system-status-indicator');
const alertBadge = document.getElementById('alert-badge');

const btnSimulate = document.getElementById('btn-simulate-issue');
const btnResolve = document.getElementById('btn-resolve-issue');

const insightsLog = document.getElementById('insights-log');
const smsModal = document.getElementById('sms-modal');
const btnCloseSms = document.getElementById('btn-close-sms');
const btnToggleSms = document.getElementById('btn-toggle-sms');

const timeInit = document.getElementById('time-init');
if(timeInit) {
    timeInit.innerText = new Date().toLocaleTimeString();
}


const navItems = document.querySelectorAll('.nav-item');
const viewSections = document.querySelectorAll('.view-section');


let simulationInterval;
let isContaminated = false;
let score = 98;
let alertsCount = 0;
let smsEnabled = true;


let currentPh = 7.2;
let currentTur = 1.5;
let currentTemp = 18.5;
let currentCond = 350;
let currentSolid = 300;

const ctx = document.getElementById('mainChart').getContext('2d');
const MAX_DATA_POINTS = 20;

Chart.defaults.color = '#94a3b8';
Chart.defaults.font.family = "'Outfit', sans-serif";

const dataStream = {
    labels: Array.from({length: MAX_DATA_POINTS}, (_, i) => i),
    datasets: [
        {
            label: 'pH Level',
            data: Array(MAX_DATA_POINTS).fill(7.2),
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderWidth: 2,
            tension: 0.4,
            yAxisID: 'y'
        },
        {
            label: 'Turbidity (NTU)',
            data: Array(MAX_DATA_POINTS).fill(1.5),
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            borderWidth: 2,
            tension: 0.4,
            yAxisID: 'y1'
        }
    ]
};

const telemetryChart = new Chart(ctx, {
    type: 'line',
    data: dataStream,
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false 
            },
            tooltip: {
                mode: 'index',
                intersect: false,
                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                titleColor: '#fff',
                bodyColor: '#cbd5e1',
                borderColor: 'rgba(255,255,255,0.1)',
                borderWidth: 1
            }
        },
        scales: {
            x: {
                display: false
            },
            y: {
                type: 'linear',
                display: true,
                position: 'left',
                grid: {
                    color: 'rgba(255, 255, 255, 0.05)'
                },
                min: 0,
                max: 14,
                title: { display: true, text: 'pH' }
            },
            y1: {
                type: 'linear',
                display: true,
                position: 'right',
                grid: {
                    drawOnChartArea: false 
                },
                min: 0,
                max: 10,
                title: { display: true, text: 'Turbidity (NTU)' }
            }
        },
        animation: {
            duration: 0 
        }
    }
});

function getNextValue(current, min, max, maxDelta, forceTrend = 0) {
    let delta = (Math.random() * maxDelta * 2) - maxDelta;
    delta += forceTrend;
    let next = current + delta;
    if (next < min) next = min;
    if (next > max) next = max;
    return Number(next.toFixed(2));
}


function updateCard(valEl, progEl, trendEl, value, type) {
    valEl.innerText = value;
    
    let isWarning = false;
    let isDanger = false;
    let trendText = "Normal";

    switch(type) {
        case 'ph':
            
            progEl.style.width = `${(value / 14) * 100}%`;
            if(value < 6.5 || value > 8.5) isDanger = true;
            else if(value < 6.8 || value > 8.2) isWarning = true;
            trendText = isDanger ? "Critical" : isWarning ? "Warning" : "Optimal";
            break;
        case 'tur':
            
            progEl.style.width = `${(value / 10) * 100}%`;
            if(value > 5) isDanger = true;
            else if(value > 3) isWarning = true;
            trendText = isDanger ? "High Risk" : isWarning ? "Elevated" : "Clear";
            break;
        case 'temp':
            progEl.style.width = `${(value / 40) * 100}%`;
            if(value > 30) isWarning = true;
            trendText = isWarning ? "Warm" : "Normal";
            break;
        case 'cond':
            progEl.style.width = `${(value / 1000) * 100}%`;
            if(value > 600) isWarning = true;
            if(value > 800) isDanger = true;
            trendText = isDanger ? "Critical" : isWarning ? "High" : "Normal";
            break;
        case 'risk':
            valEl.innerText = `${value}%`;
            progEl.style.width = `${value}%`;
            if (value < 40) isDanger = true;
            else if (value < 70) isWarning = true;
            trendText = isDanger ? "Critical" : isWarning ? "Warning" : "High";
            break;
        case 'puri':
            if (value === 'Overload') {
                isDanger = true;
                progEl.style.width = '80%';
            } else if (value === 'Stressed') {
                isWarning = true;
                progEl.style.width = '90%';
            } else {
                progEl.style.width = '100%';
            }
            trendText = isDanger ? "Failing" : isWarning ? "Working" : "Optimal";
            break;
    }


    trendEl.className = 'trend';
    progEl.classList.remove('danger');
    const cardEl = valEl.closest('.kpi-card');
    cardEl.classList.remove('alert');

    if(isDanger) {
        trendEl.classList.add('danger');
        progEl.classList.add('danger');
        cardEl.classList.add('alert');
    } else if (isWarning) {
        trendEl.classList.add('warning');
    }
    
    trendEl.innerText = trendText;
    return { isDanger, isWarning };
}

function addInsight(type, title, desc) {
    const time = new Date().toLocaleTimeString();
    const icon = type === 'danger' ? 'fa-triangle-exclamation' : (type === 'warning' ? 'fa-circle-exclamation' : 'fa-check-circle');
    
    const html = `
        <div class="insight-item ${type}">
            <i class="fa-solid ${icon}"></i>
            <div class="insight-text">
                <h4>${title}</h4>
                <p>${desc}</p>
            </div>
            <span class="time">${time}</span>
        </div>
    `;
    
    insightsLog.insertAdjacentHTML('afterbegin', html);
}


function simulateTelemetry() {
    
    let phTrend = 0;
    let turTrend = 0;
    
    if (isContaminated) {
        
        if (currentPh > 5.0) phTrend = -0.15;
        if (currentTur < 8.0) turTrend = +0.4;
        
        
        currentCond = getNextValue(currentCond, 200, 1000, 15, +10);
        score = Math.max(12, score - 5);
    } else {
        
        if (currentPh < 7.2) phTrend = +0.1;
        if (currentTur > 1.5) turTrend = -0.2;
        currentCond = getNextValue(currentCond, 200, 1000, 10, currentCond > 400 ? -10 : 0);
        score = Math.min(98, score + 2);
    }

    currentPh = getNextValue(currentPh, 0, 14, 0.05, phTrend);
    currentTur = getNextValue(currentTur, 0, 10, 0.1, turTrend);
    currentTemp = getNextValue(currentTemp, 10, 40, 0.2, 0);
    currentSolid = getNextValue(currentSolid, 50, 800, 5, isContaminated ? +15 : 0);

    
    const phStatus = updateCard(valPh, progPh, trendPh, currentPh, 'ph');
    const turStatus = updateCard(valTur, progTur, trendTur, currentTur, 'tur');
    const tempStatus = updateCard(valTemp, progTemp, trendTemp, currentTemp, 'temp');
    const condStatus = updateCard(valCond, progCond, trendCond, currentCond, 'cond');
    
    // update risk and purification based on score and status
    updateCard(valRisk, progRisk, trendRisk, score, 'risk');
    let puriStatus = isContaminated ? 'Overload' : (score < 80 ? 'Stressed' : 'Active');
    updateCard(valPuri, progPuri, trendPuri, puriStatus, 'puri');

    dataStream.datasets[0].data.push(currentPh);
    dataStream.datasets[0].data.shift();
    dataStream.datasets[1].data.push(currentTur);
    dataStream.datasets[1].data.shift();
    telemetryChart.update();
    safetyScore.innerText = `${score}%`;
    
    if (score < 40) {
        aiStatusPanel.className = 'ai-status danger';
        aiStatusPanel.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> AI ALERT: CONTAMINATION DETECTED <span id="safety-score"></span> <span id="safety-text" style="margin-left: 6px; padding-left: 6px; border-left: 1px solid currentColor;">(Unsafe)</span>';
        document.getElementById('safety-score').innerText = `${score}%`;
        systemIndicator.className = 'status-indicator danger';
    } else {
        aiStatusPanel.className = 'ai-status';
        aiStatusPanel.innerHTML = '<i class="fa-solid fa-shield-halved"></i> AI Safety Index: <span id="safety-score"></span> <span id="safety-text" style="margin-left: 6px; padding-left: 6px; border-left: 1px solid currentColor;">(Safe)</span>';
        document.getElementById('safety-score').innerText = `${score}%`;
        systemIndicator.className = 'status-indicator safe';
    }
}


simulationInterval = setInterval(simulateTelemetry, 1000);


btnSimulate.addEventListener('click', () => {
    isContaminated = true;
    btnSimulate.style.display = 'none';
    btnResolve.style.display = 'flex';
    
    addInsight('danger', 'Anomaly Detected!', 'AI identified sharp pH drop correlated with turbidity spike. High probability of industrial runoff or sewage contamination.');
    
    
    setTimeout(() => {
        if (smsEnabled) {
            smsModal.classList.add('active');
        }
        alertsCount++;
        alertBadge.innerText = alertsCount;
        alertBadge.classList.add('show');
    }, 2500);
});

btnResolve.addEventListener('click', () => {
    isContaminated = false;
    btnResolve.style.display = 'none';
    btnSimulate.style.display = 'flex';
    
    addInsight('safe', 'System Nominal', 'Water parameters are returning to optimal baseline. Risk level lowered.');
});

btnCloseSms.addEventListener('click', () => {
    smsModal.classList.remove('active');
});

if (btnToggleSms) {
    btnToggleSms.addEventListener('click', () => {
        smsEnabled = !smsEnabled;
        if (smsEnabled) {
            btnToggleSms.innerText = "ENABLED";
            btnToggleSms.style.background = "var(--status-safe)";
        } else {
            btnToggleSms.innerText = "DISABLED";
            btnToggleSms.style.background = "var(--text-muted)";
        }
    });
}


navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        
        
        navItems.forEach(nav => nav.classList.remove('active'));
    
        item.classList.add('active');
        

        viewSections.forEach(view => {
            view.classList.remove('active');
            view.classList.add('hidden');
        });
        
        
        const targetId = item.id.replace('nav-', 'view-');
        const targetView = document.getElementById(targetId);
        if (targetView) {
            targetView.classList.remove('hidden');
            targetView.classList.add('active');
        }

        
        if(targetId === 'view-dashboard') {
            setTimeout(() => {
                if(telemetryChart) telemetryChart.resize();
            }, 10);
        }
    });
});


setTimeout(() => {
    if(!isContaminated) {
        addInsight('safe', 'AI Routine Scan Complete', 'Pattern matches historical safe baseline. No anomalies detected in the last 24h.');
    }
}, 4000);
