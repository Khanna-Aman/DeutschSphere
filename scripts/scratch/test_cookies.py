import requests
import re

def test_cookies():
    cookie_str = open("cookies.txt", "r", encoding="utf-8").read().strip()
    cookies = {}
    for part in cookie_str.split(";"):
        part = part.strip()
        if "=" in part:
            name, _, value = part.partition("=")
            cookies[name.strip()] = value.strip()
            
    print(f"Loaded {len(cookies)} cookies from cookies.txt")
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
    }
    
    url = "https://notebooklm.google.com/"
    resp = requests.get(url, cookies=cookies, headers=headers, allow_redirects=True)
    print(f"Response status: {resp.status_code}")
    print(f"Final URL: {resp.url}")
    
    if "accounts.google.com" in resp.url:
        print("RESULT: Redirection to accounts.google.com occurred. Cookies are EXPIRED or INVALID.")
    else:
        print("RESULT: Successfully reached NotebookLM! Cookies are VALID.")
        # Try to find CSRF token
        csrf_patterns = [
            r'"SNlM0e":"([^"]+)"',
            r'at=([^&"]+)',
            r'"FdrFJe":"([^"]+)"',
        ]
        for pattern in csrf_patterns:
            match = re.search(pattern, resp.text)
            if match:
                print(f"Found CSRF Token: {match.group(1)}")
                break
        else:
            print("CSRF token not found in source.")

if __name__ == "__main__":
    test_cookies()
