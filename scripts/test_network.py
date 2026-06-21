import requests
import sys

def test_connection():
    url = "https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/user.svg"
    try:
        response = requests.get(url, timeout=5)
        if response.status_code == 200:
            print("SUCCESS: Network is active. Fetched SVG icon successfully.")
            print("Content preview (first 100 chars):", response.text[:100])
            sys.exit(0)
        else:
            print(f"FAILED: Status code {response.status_code}")
            sys.exit(1)
    except Exception as e:
        print("ERROR: Connection failed:", str(e))
        sys.exit(2)

if __name__ == "__main__":
    test_connection()
