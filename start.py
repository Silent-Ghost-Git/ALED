"""
ALED - Starter
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
print("  ALED")
print("=" * 40)
print()

# Start server - output will show in console
server_process = subprocess.Popen(
    [sys.executable, "server.py"],
    cwd=HERE,
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
    text=True,
    bufsize=1
)

time.sleep(2)
webbrowser.open(f"http://localhost:{PORT}")

print(f"Server running at http://localhost:{PORT}")
print("Dashboard is open!")
print("=" * 40)
print("Server output:")
print("-" * 40)

# Print server output in real-time
import threading
def print_output():
    for line in iter(server_process.stdout.readline, ''):
        print(line, end='')
        
output_thread = threading.Thread(target=print_output, daemon=True)
output_thread.start()

print("\nPress Enter or Ctrl+C to exit...")

try:
    input()
except KeyboardInterrupt:
    pass

print("\nStopping server...")
server_process.terminate()
server_process.wait()

print("\nGoodbye!")
