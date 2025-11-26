# PagerDuty Incident Noise Simulator v1.6

A full-stack application for generating realistic incident noise and telemetry signals against a PagerDuty account. Perfect for demos, workshops, and chaos engineering simulations.

![Version](https://img.shields.io/badge/version-1.6-blue) ![Docker](https://img.shields.io/badge/docker-ready-green)

## 🚀 New in v1.6
- **Failure Campaigns:** Design complex, multi-step failure scenarios (Alerts + Change Events) with a visual editor.
- **Zero-Config Webhooks:** Trigger campaigns from any external tool (CI/CD, Slack, scripts) using a simple "Magic Link"—no headers required.
- **Crux Import:** Import existing Crux payload definitions directly into the simulator.
- **Event Bursts:** Simulate "Event Storms" with compressed alert bursts.
- **Live Metrics:** Real-time tracking of API RPM, MTTA, and MTTR.

## ✨ Features

### 🎛️ Interactive Simulation
- **Realistic Traffic:** Generates incidents using a Poisson distribution to mimic real-world entropy.
- **Full Lifecycle:** Automatically acknowledges and resolves incidents based on configurable MTTA/MTTR targets per severity.
- **Responder Simulation:** Automatically adds notes and requests responders to simulate team activity.

### 💥 Campaign Engine
- **Visual Editor:** Create linear scenarios (e.g., "Database Upgrade Failure") that mix Incidents and Change Events.
- **Change Events:** Correlate deployments (Change Events) with subsequent failures to demonstrate Root Cause Analysis.
- **Webhook Triggers:** Each campaign generates a unique trigger URL. Embed it in your GitHub Actions or Jenkins pipeline to fire a simulation automatically on build.

### 📊 Monitor Dashboard
- **Real-time Trends:** Visual sparklines for event volume.
- **Metric Cards:** Track your demo's "performance" with live MTTA/MTTR stats.
- **API Budgeting:** Monitor API Request usage (RPM) to stay within safe demo limits.

## 🐳 Quick Start (Docker)

The easiest way to run the simulator is via Docker Compose. This spins up the Frontend, Backend, and Database in isolation.

```bash
# 1. Clone the repo
git clone https://github.com/pd-cbell/pd-noise-generator.git
cd pd-noise-generator

# 2. Start the stack
docker-compose up --build -d

# 3. Access the UI
open http://localhost:8080
```

## ☁️ Deploy to AWS

A CloudFormation template is provided to launch the simulator on a standalone EC2 instance.

1.  Go to the [AWS CloudFormation Console](https://console.aws.amazon.com/cloudformation).
2.  Create Stack -> Upload a template file.
3.  Upload `deploy/aws-cfn.yaml`.
4.  Select an SSH Key Pair and launch.
5.  Once complete, visit `http://<EC2-Public-IP>:8080`.

## 🛠️ Usage Guide

### 1. Configure
Go to the **Configure** tab.
- **Credentials:** Enter your PagerDuty **User API Token** and a **Global Routing Key** (Events v2).
- **Select Services:** Choose which services should receive noise.
- **Profiles:** Save your configuration as a Profile to switch between demos easily.

### 2. Campaigns
Go to the **Campaigns** tab.
- **Create:** Build a new scenario. Add steps for "Change Events" (deployments) and "Incidents" (alerts).
- **Webhook:** Copy the Webhook URL to trigger this scenario remotely.
- **Import:** Use the **Import (Crux)** button to load pre-defined scenarios from JSON.

### 3. Monitor
Go to the **Monitor** tab.
- **Control:** Start/Pause the noise generator.
- **Observe:** Watch incidents trigger, ack, and resolve in real-time.

## 🏗️ Architecture

- **Frontend:** React (Vite) + Tailwind CSS + Zustand.
- **Backend:** Node.js (Express) + Prisma (PostgreSQL).
- **Database:** PostgreSQL 15.

## 📜 License

This project is provided as-is for demonstration purposes.