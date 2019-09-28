class Entry{
    constructor(title, run, name, sex, age, breed, request, out, special, timeRequest, time){
        this.run = run;
        this.name = name;
        this.sex = sex;
        this.age = age;
        this.breed = breed;
        this.request = request;
        this.out = out;
        this.timeRequest = timeRequest;
        this.time = time;
        this.title = title;

        if(!special || special === "Request:"){
            this.special = null;
        }
        else{
            this.special = special;
        }
    }
}

module.exports.Entry = Entry;