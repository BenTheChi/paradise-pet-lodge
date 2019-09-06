class Employee{
    constructor(name, timeIn, timeOut){
        this.name = name;
        this.timeIn = timeIn;
        this.timeOut = timeOut;
        this.entries = []
        
        if(timeOut < timeIn){
            this.AmTimeLeft = 0
            this.PmTimeLeft = 0
        }
        else if(timeIn <= 12 && timeOut <= 12){
            this.AmTimeLeft = timeOut - timeIn;
            this.PmTimeLeft = 0;
        }
        else if(timeIn > 12 && timeOut > 12){
            this.AmTimeLeft = 0;
            this.PmTimeLeft = timeOut - timeIn;
        }
        else if(timeIn <= 12 && timeOut > 12){
            this.AmTimeLeft = 12 - timeIn
            this.PmTimeLeft = timeOut - 12
        }
        else{
            this.AmTimeLeft = 0
            this.PmTimeLeft = 0
        }

        // const scheduleLength = (timeOut - timeIn) * 4;
        // this.schedule = new Array(scheduleLength);
        this.buildings = new Set();
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