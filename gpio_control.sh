#!/bin/bash

GPIO_PIN=25
GPIO_CHIP=4
GPIOD_PATH=/usr/bin/gpioset

if [ "$1" = "1" ]; then
  echo "Setting GPIO $GPIO_PIN to 1 (stopped)"
  $GPIOD_PATH gpiochip${GPIO_CHIP} ${GPIO_PIN}=1
elif [ "$1" = "0" ]; then
  echo "Setting GPIO $GPIO_PIN to 0 (running)"
  $GPIOD_PATH gpiochip${GPIO_CHIP} ${GPIO_PIN}=0
else
  echo "Invalid argument: $1"
  exit 1
fi
