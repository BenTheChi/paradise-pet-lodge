export default class Employee{
    constructor(name, timeIn, timeOut){
        this.name = name;
        this.timeIn = timeIn;
        this.timeOut = timeOut;
        this.entries = []
        this.AmTimeLeft = Math.abs(12 - timeIn);
        this.PmTimeLeft = Math.abs(timeOut - 12);
        const scheduleLength = (timeOut - timeIn) * 4
        this.schedule = new Array(scheduleLength)
    }

    numToTime(num){
        //TODO
        return 0
    }
}

module.exports.Employee = Employee;