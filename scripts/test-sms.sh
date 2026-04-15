#!/bin/bash
# Test mNotify SMS delivery
curl -sS -X POST "https://api.mnotify.com/api/sms/quick?key=TTEWyqAlSvPGXAnpSML3pvL8i" \
  -H "Content-Type: application/json" \
  -d '{"recipient":["0551149981"],"sender":"RiderGuy","message":"Test from RiderGuy API - OTP delivery check.","is_schedule":false,"schedule_date":""}'
echo ""
echo "---"
# Also check balance
curl -sS "https://api.mnotify.com/api/balance/sms?key=TTEWyqAlSvPGXAnpSML3pvL8i"
echo ""
