# Use a slim Python image
FROM python:3.11-slim

# Avoid Python writing .pyc files and keep logs unbuffered
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Set working directory inside the container
WORKDIR /app

# Install system deps (optional, but can help with some libs)
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies separately so Docker can cache this layer
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Copy the rest of your code
COPY . .

# Expose the port Flask runs on
EXPOSE 1337

# Default command: run your Flask script
CMD ["python", "embedder.py"]
