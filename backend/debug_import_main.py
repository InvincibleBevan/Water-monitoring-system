import importlib, traceback

try:
    importlib.import_module('main')
    print('IMPORTED_OK')
except Exception:
    traceback.print_exc()
