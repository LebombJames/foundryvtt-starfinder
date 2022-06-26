const fs = require('fs');
const oldPath = "E:\\User Files\\Documents\\GitHub\\foundryvtt-starfinder\\src\\items\\equipment"
const newPath = ".";
let newFilesMapped = []
let oldFilesMapped = []
let oldFile


let sanitize = null;
try {
    sanitize = require("sanitize-filename");
} catch (err) {   
}   

let newFiles = fs.readdirSync(newPath, 'utf8')
let oldFiles = fs.readdirSync(oldPath, 'utf8')

newFilesMapped = newFiles.map(i => {
    if (i.split('.').pop() === "json") {
        let json = fs.readFileSync(`${newPath}/${i}`, {
            encoding: 'utf8',
            flag: 'r+'
        });
        
        return JSON.parse(json);
    } else {
        return
    }
})
    
oldFilesMapped = oldFiles.map(i => {
    if (i.split('.').pop() === "json") {
        let json = fs.readFileSync(`${oldPath}/${i}`, {
            encoding: 'utf8',
            flag: 'r+'
        });
        
        return JSON.parse(json);
    } else {
        return
    }
})

for (let newFile of newFilesMapped) {
    try {
        oldFile = oldFilesMapped.find(i => i.name === newFile.name)
        
        if (oldFile) {
            newFile._id = oldFile._id
            
            const output = JSON.stringify(newFile, null, 2);
                                
            let filename = newFile.name;
            if (sanitize) {
                 filename = sanitize(filename);
            }
            filename = filename.replace(/[\s]/g, "_");
            filename = filename.replace(/[,;]/g, "");
            filename = filename.toLowerCase();
            
            console.log(`Migrated ${newFile.name} to Migrated/${filename}.json`)
            fs.writeFileSync(`Migrated/${filename}.json`, output)
        }
    } catch (err) {
    }
    
}