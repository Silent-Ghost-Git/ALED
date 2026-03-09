"""
My Study Dashboard - Starter
Starts custom backend server.py and opens browser.
"""

import os
import subprocess
import sys
import time
import webbrowser

PORT = 8000
HERE = os.path.dirname(os.path.abspath(__file__))

print("=" * 40)
print("  My Study Dashboard")
print("=" * 40)
print()

server_process = subprocess.Popen(
    [sys.executable, "server.py"],
    cwd=HERE,
)

time.sleep(1.2)
webbrowser.open(f"http://localhost:{PORT}")

print(f"Server running at http://localhost:{PORT}")
print("Dashboard is open!")
print("Press Enter to stop the server")
print("=" * 40)

try:
    input()
except KeyboardInterrupt:
    pass
finally:
    if server_process.poll() is None:
        server_process.terminate()
        try:
            server_process.wait(timeout=3)
        except subprocess.TimeoutExpired:
            server_process.kill()

print("\nGoodbye!")
