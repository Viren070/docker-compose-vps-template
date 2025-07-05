# Use an official lightweight Python image
FROM python:3.13-slim

# Set the working directory
WORKDIR /app

# Copy files
COPY main.py .

# Install dependencies
RUN pip install croniter python-dotenv requests schedule

# Command to run the script
CMD ["python", "main.py"]
