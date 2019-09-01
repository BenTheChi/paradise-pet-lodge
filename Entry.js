class Entry{
    constructor(run, name, sex, age, breed, request, out, checkedIn, timeRequest, time){
        this.run = run;
        this.name = name;
        this.sex = sex;
        this.age = age;
        this.breed = breed;
        this.request = request;
        this.out = out;
        this.checkedIn = checkedIn;
        this.timeRequest = timeRequest;
        this.time = time;
    }
}

module.exports.Entry = Entry;