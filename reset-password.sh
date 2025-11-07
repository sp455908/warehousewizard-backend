#!/bin/bash

# Password Reset Script for Warehouse Wizard
# Usage: ./reset-password.sh <email> <new-password>

if [ $# -ne 2 ]; then
    echo "Usage: ./reset-password.sh <email> <new-password>"
    echo "Example: ./reset-password.sh shubhampatil@gmail.com newpassword123"
    exit 1
fi

echo "Resetting password for: $1"
node reset-password.js "$1" "$2"
