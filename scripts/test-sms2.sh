#!/bin/bash
# Check mNotify sender IDs
echo "=== Sender IDs ==="
curl -sS "https://api.mnotify.com/api/senders?key=TTEWyqAlSvPGXAnpSML3pvL8i"
echo ""
echo ""
echo "=== Try with default sender ==="
curl -sS -X POST "https://api.mnotify.com/api/sms/quick?key=TTEWyqAlSvPGXAnpSML3pvL8i" \
  -H "Content-Type: application/json" \
  -d '{"recipient":["0551149981"],"sender":"mNotify","message":"RiderGuy: Your verification code is 123456. Expires in 5 min.","is_schedule":false,"schedule_date":""}'
echo ""
