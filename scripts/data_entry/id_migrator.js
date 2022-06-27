const fs = require('fs');
let sanitize = null;
try {
    sanitize = require("sanitize-filename");
} catch (err) {   
} 

const oldPath = "E:\\User Files\\Documents\\GitHub\\foundryvtt-starfinder\\src\\items\\equipment";
const newPath = ".";

  

let newFiles = fs.readdirSync(newPath, 'utf8');
let oldFiles = fs.readdirSync(oldPath, 'utf8');

let newFilesMapped = newFiles.filter(i => i.split('.').pop() === "json").map(i => {
    let json = fs.readFileSync(`${newPath}/${i}`, {
        encoding: 'utf8',
        flag: 'r+'
    });
    
    return JSON.parse(json);
});
    
let oldFilesMapped = oldFiles.filter(i => i.split('.').pop() === "json").map(i => {
    let json = fs.readFileSync(`${oldPath}/${i}`, {
        encoding: 'utf8',
        flag: 'r+'
    });
    
    return JSON.parse(json);
});

for (let newFile of newFilesMapped) {
    try {
        let oldFile = oldFilesMapped.find(i => i.name === newFile.name);
        
        if (oldFile) {
            newFile._id = oldFile._id;
            
            const output = JSON.stringify(newFile, null, 2);
                                
            let filename = newFile.name;
            if (sanitize) filename = sanitize(filename);
            filename = filename.replace(/[\s]/g, "_");
            filename = filename.replace(/[,;]/g, "");
            filename = filename.toLowerCase();
            
            fs.writeFileSync(`Migrated/${filename}.json`, output);
            console.log(`Migrated ${newFile.name} to Migrated/${filename}.json`);
        } else {
            console.log(`Didn't find a match for ${newFile.name}!`)
        };
    } catch (err) {
    };
};