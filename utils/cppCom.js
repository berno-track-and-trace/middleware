import { exec } from 'child_process';

class CppProgram {
  constructor(filePath) {
    this.filePath = filePath;
    this.childProcess = null;
  }

  start() {
    if (this.childProcess) {
      console.log('C++ program is already running.');
      return;
    }

    this.childProcess = exec(this.filePath, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing C++ program: ${error}`);
        return;
      }
      console.log(`C++ program output: ${stdout}`);
    });

    this.childProcess.on('exit', (code) => {
      console.log(`C++ program exited with code ${code}`);
      this.childProcess = null;
    });

    console.log('C++ program started.');
  }

  stop() {
    if (!this.childProcess) {
      console.log('No C++ program is currently running.');
      return;
    }

    this.childProcess.kill();
    console.log('C++ program stopped.');
  }
}
export default CppProgram;

// Example usage:
// const myCppProgram = new CppProgram('./mycppprogram');
// myCppProgram.start(); // Start the C++ program
// To stop the program, you can call myCppProgram.stop();
