#!/bin/bash
curl -s -X POST https://api.myriderguy.com/api/v1/auth/login/password \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@myriderguy.com","password":"Test1234"}' | python3 -m json.tool
