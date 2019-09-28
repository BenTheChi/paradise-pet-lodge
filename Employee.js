class Employee{
    constructor(name, timeIn, timeOut){
        if(timeOut < timeIn){
            throw "Time Out must be greater than Time In"
        }

        this.name = name;
        this.timeIn = timeIn;
        this.timeOut = timeOut;
        this.entries = [];
        this.buildings = new Set();
        this.getTimeBlocks();
    }

    getTimeBlocks(){
        const AM_CUTOFF = 10;
        const NOON_CUTOFF = 14;
        let timeIn = this.timeIn;
        let timeOut = this.timeOut;

        this.PmTimeLeft = 0;
        this.NoonTimeLeft = 0;
        this.AmTimeLeft = 0;
        this.totalAm = 0;
        this.totalNoon = 0;
        this.totalPm = 0;

        if(this.timeOut > NOON_CUTOFF){
            if(timeIn >= NOON_CUTOFF){
                this.PmTimeLeft = timeOut - timeIn;
                return
            }
            else{
                this.PmTimeLeft = timeOut - NOON_CUTOFF;
                timeOut = NOON_CUTOFF;
            }
        }
        if(this.timeOut > AM_CUTOFF){
            if(timeIn >= AM_CUTOFF){
                this.NoonTimeLeft = timeOut - timeIn;
                return
            }
            else{
                this.NoonTimeLeft = timeOut - AM_CUTOFF;
                timeOut = AM_CUTOFF;
            }
        }
        this.AmTimeLeft = timeOut - timeIn;
        this.totalAm = this.AmTimeLeft;
        this.totalNoon = this.NoonTimeLeft;
        this.totalPm = this.PmTimeLeft;
    }

    formattedTimeIn(){
        let minutes = Math.ceil((this.timeIn - Math.floor(this.timeIn)) * 60)
        let hours = Math.floor(this.timeIn)
        let ampm = " AM"

        if(hours > 12){
            hours = hours - 12
            ampm = " PM"
        }
        if(minutes === 0){
            minutes = "00"
        }
        else if(minutes < 10){
            minutes = "0" + minutes
        }

        return hours + ":" + minutes + ampm
    }

    formattedTimeOut(){
        let minutes = Math.ceil((this.timeOut - Math.floor(this.timeOut)) * 60)
        let hours = Math.floor(this.timeOut)
        let ampm = " AM"

        if(hours > 12){
            hours = hours - 12
            ampm = " PM"
        }
        if(minutes === 0){
            minutes = "00"
        }
        else if(minutes < 10){
            minutes = "0" + minutes
        }

        return hours + ":" + minutes + ampm
    }
}

module.exports.Employee = Employee;