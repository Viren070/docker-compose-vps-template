import requests
import schedule
import time
import datetime
import os
import logging
from dotenv import load_dotenv
from croniter import croniter
import pytz
import re

# Configuration
load_dotenv()

TOKENS = eval(os.getenv("TOKENS", "[]"))
BASE_API = "https://api.real-debrid.com/rest/1.0"
ENDPOINTS = {"traffic": "/traffic/details", "user": "/user"}
INTERVAL_HOURS = int(os.getenv("INTERVAL_HOURS", 1))
INTERVAL_SECONDS = int(os.getenv("INTERVAL_SECONDS", 0))
CRON_SCHEDULE = os.getenv("CRON_SCHEDULE", None)
REALDEBRID_TIMEZONE_STRING = "Europe/Paris"
CRONTAB_TIMEZONE_STRING = os.getenv("TZ", "UTC")
# Set up logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# time.tzset() # ensure croniter uses the correct timezone
# use Europe/Paris as the default timezone as Real-Debrid is based in France
crontab_timezone = pytz.timezone(CRONTAB_TIMEZONE_STRING)
realdebrid_timezone = pytz.timezone(REALDEBRID_TIMEZONE_STRING)


# set up a file to write datapoints to for traffic
TRAFFIC_FILE_PATH = os.getenv("TRAFFIC_FILE_PATH", os.path.join("data", "traffic_data.csv"))
if not os.path.exists(TRAFFIC_FILE_PATH):
    os.makedirs(os.path.dirname(TRAFFIC_FILE_PATH), exist_ok=True)
    with open(TRAFFIC_FILE_PATH, "w") as f:
        f.write("username,datetime,traffic\n")


def sanitised_token(token):
    # simply replace all but the first character and last 5 characters with *
    return token[0] + "*" * (len(token) - 6) + token[-5:]


def format_bytes(bytes):
    for unit in ["B", "KB", "MB", "GB", "TB"]:
        if bytes < 1024:
            return f"{bytes:.2f} {unit}"
        bytes /= 1024
    return f"{bytes:.2f} PB"


def format_seconds(seconds):
    # format seconds into a string like "date (x days from now)"
    if seconds < 0:
        return "Expired"
    elif seconds < 60:
        return f"{seconds} seconds"
    elif seconds < 3600:
        return f"{seconds // 60} minutes"
    elif seconds < 86400:
        return f"{seconds // 3600} hours"
    elif seconds < 2592000:
        return f"{seconds // 86400} days"
    elif seconds < 31536000:
        # return x months, y days
        months = seconds // 2592000
        days = (seconds % 2592000) // 86400
        return f"{months} months, {days} days"
    else:
        # return x years, y months
        years = seconds // 31536000
        months = (seconds % 31536000) // 2592000
        return f"{years} years, {months} months"


def get_traffic(token):
    today = datetime.datetime.now(realdebrid_timezone).strftime("%Y-%m-%d")
    params = {
        "start": today,
    }
    try:
        response = requests.get(
            f"{BASE_API}{ENDPOINTS['traffic']}",
            params=params,
            headers={"Authorization": f"Bearer {token}"},
        )
        data = response.json()
    except Exception as e:
        logger.error(f"Failed to get traffic data for {sanitised_token(token)}: {e}")
        return None
    if response.status_code == 200:
        if today in data:
            traffic_bytes = data[today]["bytes"]
            return traffic_bytes
        elif data == []:
            return 0
        else:
            return None
    else:
        error, error_code = data.get("error", "Unknown error"), data.get("error_code", "Unknown error code")
        logger.error(
            f"Failed to get traffic data for {sanitised_token(token)}: {response.status_code} - {error} ({error_code}) "
        )
        return None


def get_user_details(token):
    try:
        response = requests.get(
            f"{BASE_API}{ENDPOINTS['user']}",
            headers={"Authorization": f"Bearer {token}"},
        )
        data = response.json()
    except Exception as e:
        logger.error(f"Failed to get user details for {sanitised_token(token)}: {e}")
        return None
    if response.status_code != 200:
        error, error_code = data.get("error", "Unknown error"), data.get("error_code", "Unknown error code")
        logger.error(
            f"Failed to get user details for {sanitised_token(token)}: {error} ({error_code})"
        )
        return None
    return data


def get_account_data():
    if len(TOKENS) == 0:
        logger.error("No tokens found in configuration")
        return
    lines = [""]
    logger.info("Checking account data for {} tokens...".format(len(TOKENS)))
    for token in TOKENS:
        user = get_user_details(token)
        if user is None:
            continue
        premium = user["type"] == "premium"
        if not premium:
            logger.error(f"Token {sanitised_token(token)} is not a premium account")
            continue
        # 'premium' is seconds that the account is premium for
        expires_in = user["premium"]
        expiry_date = user["expiration"].split("T")[0]
        traffic = get_traffic(token)
        if traffic is None:
            continue
        # write the traffic data to a file
        with open(TRAFFIC_FILE_PATH, "a") as f:
            f.write(f"{user['username']},{datetime.datetime.now(realdebrid_timezone)},{traffic}\n")

        lines.append(f" {user['username']}: ")
        lines.append(f"  ├─ Type: {user["type"].capitalize()}")
        if premium:
            lines.append(
                f"  ├─ Premium until: {expiry_date} | {format_seconds(expires_in)} from now"
            )
        lines.append(f"  ├─ Traffic today: {format_bytes(traffic)}")
        lines.append(f"  └─ Fidelity Points: {user['points']:,}")
        lines.append("")


        time.sleep(0.5)

    return lines

def generate_traffic_summary():
    with open(TRAFFIC_FILE_PATH, "r") as f:
        lines = f.readlines()
    traffic_data = {}
    user_last_traffic = {}

    current_date = datetime.datetime.now(realdebrid_timezone).strftime("%Y-%m-%d")
    for line in lines[1:]:
        username, datetime_str, traffic = line.strip().split(",")
        date_str, time_str = datetime_str.split(" ")
        
        if date_str == current_date:
            realdebrid_datetime = datetime.datetime.fromisoformat(datetime_str)
            crontab_datetime = realdebrid_datetime.astimezone(crontab_timezone)
            hour = crontab_datetime.strftime("%H")
            traffic_value = float(traffic.split(" ")[0])
            
            # Calculate hourly traffic per user
            if username in user_last_traffic:
                hour_traffic = max(0, traffic_value - user_last_traffic[username])
            else:
                hour_traffic = traffic_value  # First occurrence, take as initial traffic
            
            # Update hourly traffic sum
            traffic_data[hour] = traffic_data.get(hour, 0) + hour_traffic
            
            # Store last recorded traffic for this user
            user_last_traffic[username] = traffic_value

    # Prepare output log
    lines = [""]
    total_traffic = 0
    lines.append("      Traffic Summary:")
    for hour in sorted(traffic_data.keys()):
        traffic = traffic_data[hour]
        total_traffic += traffic
        lines.append(f"         ├─ {hour}:00 - {format_bytes(traffic)}")
    lines.append(f"         └─ Total Today: {format_bytes(total_traffic)}")
    lines.append("")
    return lines

def print_account_summaries():
    lines = [""]
    lines.extend(
        [
            "=" * 60,
            f"Real Debrid Account Summary - {datetime.datetime.now(crontab_timezone).strftime("%H:%M")}".center(60),
            "=" * 60,
            "",
        ]
    )
    lines.extend(get_account_data())
    lines.extend(generate_traffic_summary())
    lines.append("=" * 60)
    lines.append("")
    logger.info("\n".join(lines))

if not CRON_SCHEDULE:
    if INTERVAL_HOURS:
        schedule.every(INTERVAL_HOURS).hours.do(print_account_data)
    elif INTERVAL_SECONDS:
        schedule.every(INTERVAL_SECONDS).seconds.do(print_account_data)


if __name__ == "__main__":
    if CRON_SCHEDULE:
        base_time = datetime.datetime.now(crontab_timezone)
        cron = croniter(CRON_SCHEDULE, base_time)
        while True:
            next_run = cron.get_next(datetime.datetime)
            logger.info(f"Next run scheduled for {next_run} {CRONTAB_TIMEZONE_STRING}")
            sleep_duration = (next_run - datetime.datetime.now(crontab_timezone)).total_seconds()
            if sleep_duration > 0:
                time.sleep(sleep_duration)
            print_account_summaries()
            base_time = next_run
            cron = croniter(CRON_SCHEDULE, base_time) 

    while not CRON_SCHEDULE and (INTERVAL_HOURS or INTERVAL_SECONDS):
        schedule.run_pending()
        time.sleep(1)
