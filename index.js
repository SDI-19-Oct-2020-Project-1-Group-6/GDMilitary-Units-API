const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const cors = require('cors');

var pgp = require('pg-promise')(/* options */)
var dbuser = process.env.DBUSER || "postgres"
var dbpass = process.env.DBPASS || "postgres"
var address = process.env.DBADDRESS || "localhost"
var dbport = process.env.DBPORT || 4445
var dbname = process.env.DBNAME || "postgres"
var db = pgp(`postgres://${dbuser}:${dbpass}@${address}:${dbport}/${dbname}`)
var port = 4444;
app.use(cors())
app.use(bodyParser.json())
app.options('*', cors())

function statusMessage(responder,code,message, result=undefined) {
   // console.log('sending status: ',code,message,result);
    responder.status(code).json({
        code:code,
        message:message,
        result:result
    });
}

app.get('/units',(req,resp)=>{
    db.query(`SELECT * from getUnits();`)
        .then(data=>statusMessage(resp,200,'success',data))
        .catch(()=>statusMessage(resp,500,"Failed to get unit data"));
})
app.get('/units/:unitName',(req,resp)=> {
    // lets go bobby tables
    db.query('SELECT * from getUnit($1);',[req.params.unitName])
     .then(data=>{
         if (!Array.isArray(data) || data.length<1) {
             statusMessage(resp,404,'no unit found')
         }else{
             data=data[0];
             if (!data.afscs || data.afscs === null) {
                 data.afscs=[];
             }
            statusMessage(resp,200,'success',data)
         }
     })
     .catch(()=>statusMessage(resp,500,"Error while finding unit"));
})
app.post('/units',(req,resp)=>{
    const {name,location,size,afscs} = req.body;
    if (name && location && size) {
        db.query('SELECT * from addUnit($1,$2,$3,$4)',[
                name,
                location,
                size,
                (Array.isArray(afscs) && afscs.length > 0)?afscs:null
            ])
            .then(unit=>statusMessage(resp,200,'success',unit))
            .catch(error=>{
                console.log(error.message);
                statusMessage(resp,500,'failed to process provided data',req.body);
            })
    }else{
        statusMessage(resp,400,'Missing required data');
    }
    
})
app.delete('/units/:unitName/:afsc',(req,resp)=>{
    let unit = db.one("SELECT id FROM getUnit($1)",req.params.unitName);
    db.result('DELETE FROM units_afscs where unit_id=$1 AND afsc_id=$2',[unit.id,req.params.afsc])
        .then(result=>{
            if (result.rowCount > 0) {
                statusMessage(resp,200,'successfully removed afsc from unit');
            }else{
                statusMessage(resp,500,'successfully removed afsc from unit');
            }
        }).catch(error=>{
            console.log(error.message);
            statusMessage(resp,500,'error while removing afsc from unit');
        })
});
app.delete('/units/:unitName',(req,resp)=>{
    db.result('DELETE FROM units where name=$1',[req.params.unitName])
    .then(result=>{
        if (result.rowCount > 0) {
            statusMessage(resp,200,'successfully removed '+result.rowCount+' units');
        }else{
            statusMessage(resp,200,'failed to remove unit '+req.params.unitName);
        }
    }).catch(error=>{
        console.log(error.message); 
        statusMessage(resp,500,'Server error while attempting to remove unit '+req.params.unitName);
    })
    //statusMessage(resp,500,'failed to process request');
})
app.post('/afscs',(req,resp)=>{
    db.query('INSERT INTO afscs (identifier,name) VALUES ($1,$2) ON CONFLICT (identifier) DO UPDATE SET name=$2')
        .then(data=>{
            statusMessage(resp,200,'success');
        })
        .catch(error=>{
            console.log(error.message);
            statusMessage(resp,500,'failed to add afsc');
        });
})
app.patch('/units/:unitName',(req,resp)=>{
    //build query for update...also let bobby tables in
    let query = 'UPDATE units SET name='+req.params.unitName;
    query += (req.body.location)?' location=\''+req.body.location+'\'':'';
    query += (req.body.size)?' size='+req.body.size:'';
    db.result(query).then(result=>{
        if (result.rowCount>0) {
            if (Array.isArray(req.body.afscs) && req.body.afscs.length>0) {
                db.query("SELECT addAFSCStoUnit($1,$2)",req.params.unitName,req.body.afscs)
            }
            statusMessage(resp,200,'success');
        }
        statusMessage(resp,400,'Cannot find unit with the name '+req.params.unitName);
    }).catch(error=>{
        console.log(error.message);
        statusMessage(resp,500,'Server error while attempting to update unit afscs');
    })
    //statusMessage(resp,500,'failed to process patch request');
})
app.listen(port,()=>console.log("Listening on port 4444"))