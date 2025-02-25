import time
import psutil
import gpiod as GPIO

GPIO_PIN = 25
PROCESS_NAME = 'index.js'

# Initialize GPIO
chip = GPIO.Chip('gpiochip4')

gpio_line = chip.get_line(GPIO_PIN)
gpio_line.request(consumer="LED", type=GPIO.LINE_REQ_DIR_OUT)


# Function to check if a specific process is running
def is_process_running(process_name):
    for proc in psutil.process_iter(['cmdline']):
        try:
            if process_name in proc.info['cmdline']:
                return True
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            pass
    return False





# Main loop
try:
    # Initial state of the process
    process_running = is_process_running(PROCESS_NAME)
    print(process_running)
    # Set initial GPIO state based on the initial process state
    # gpio_line.set_value(0)
    gpio_line.set_value(0) if process_running else gpio_line.set_value(1)

    while True:
        # Check if the Node.js process is running
        current_process_state = is_process_running(PROCESS_NAME)
        # print(current_process_state)

        if current_process_state != process_running:
            # If the process state has changed, update the GPIO pin
            gpio_line.set_value(0) if current_process_state else gpio_line.set_value(1)
            if current_process_state:
                print("MiddleWare is running")
            else :
                print("MiddleWare is stopped")
            # Update the process_running to the current state
            process_running = current_process_state
        
        # Wait for a while before checking again
        time.sleep(0.5)

except KeyboardInterrupt:
    pass

finally:
    # Clean up GPIO settings
    gpio_line.release()
