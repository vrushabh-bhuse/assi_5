const express = require('express');
const env=require('dotenv').config();
const exphbs = require('express-handlebars');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const seceret = "assd123^&*^&*ghghggh";
const oneDay = 1000 * 60 * 60 * 24;
const sessions = require('express-session');
const PORT = process.env.PORT;
const bcrypt = require('bcrypt');
const hbs = require('nodemailer-express-handlebars');
const saltRounds = 10;
const app = express();
const path = require('path')
app.use('/static', express.static(path.join(__dirname, 'public')))
const crypto=require('crypto');
//database connection 
mongoose.connect("mongodb+srv://admin:admin@cluster0.amoszml.mongodb.net/cart")
    .then(res => console.log("MongoDB Connected"))
    .catch(err => console.log("Error : " + err));
//end db connection 

//middlewares for our app
app.use(sessions({
    secret: seceret,
    saveUninitialized: true,
    cookie: { maxAge: oneDay },
    resave: false
}))
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.engine('handlebars', exphbs.engine())
app.set('view engine', 'handlebars');
app.set('views', './views');
app.use(cookieParser());
const userModel = require('./model/User');
const tokenModel=require('./model/tokenModel');
const nodemailer = require("nodemailer");
const multer  = require('multer')
const { isTemplateLiteralToken } = require('typescript');
var session;
let transporter=nodemailer.createTransport({
    service:"gmail",
    port:587,
    secure:false,
    auth:{
        user:"vrushabhbhuse1020@gmail.com",
        pass:"nwtiygwvntevvrnz"
    }
});
transporter.use('compile',hbs(
    {
        viewEngine:"nodemailer-express-handlebars",
        viewPath:"views/emailTemplates/"
    }
))
const storage=multer.diskStorage({
    destination:function(req,file,cb){
      cb(null,path.join(__dirname,"/public"))
    },
    filename:function(req,file,cb){
        fileExtension=path.extname(file.originalname);
        cb(null,file.fieldname+"-"+Date.now()+fileExtension)

    }
})
const upload=multer({storage:storage,
    fileFilter:(req,file,cb)=>{
        if(file.mimetype=="image/png" || file.mimetype=="image/jpeg"){
           cb(null,true)
        }
        else{
            cb(null,false);
             cb(new Error("Only png and jpg formet allowed"))
        }
    }});
const uploadSingle=upload.single("att");

app.get("/", (req, res) => {
        return res.render("home")
})
app.get("/login", (req, res) => {
    try {
        let auth = req.query.msg ? true : false;
   let username=req.session.username;
    if (auth) {
        return res.render("login", { error: 'Invalid username or password' });
    }
    else if(username){
        return res.redirect(`/welcome?uname=${username}`)
    }
    else{
        res.render("login");
    }
    } catch (error) {
        res.send('error occured')
    }
    
})
app.post("/postlogin", (req, res) => {
    let { uname, password } = req.body;
    userModel.findOne({username: uname }, (err, data) => {
        if (err) {
            return res.redirect("/login?msg=fail");
        }
        else if (data == null) {
            return res.redirect("/login?msg=fail");
        }
        else {
            if (bcrypt.compareSync(password, data.password)) {
                session = req.session;
                session.username = uname;
                console.log(req.session);
                return res.redirect(`/welcome?uname=${uname}`);
            }
            else {
                return res.redirect("/login?msg=fail");
            }
        }
    })


})
app.get("/regis", (req, res) => {
    res.render("regis");
})
app.post("/postregis", (req, res) => {
    uploadSingle(req,res,(err)=>{
    if(err){
        res.render("regis", { error:"fail to upload" })
    }
    else
    {
    let { email,uname, password} = req.body;
    const hash = bcrypt.hashSync(password, saltRounds);
    userModel.create({ username: uname,email:email,password: hash,status:0,image:req.file.filename})
    .then(data => {
            let mailOptions={
                from:'vrushabhbhuse1020@gmail.com',
                to:['vrushabhbhuse1020@gmail.com'],
                subject:"Account verification",
                template:'mail',
                context:{username:uname,email:email,_id:data._id
                }
            }
            transporter.sendMail(mailOptions,(err,info)=>{
                if(err){ console.log(err)}
                else{
                     console.log("Mail send : "+info)
                }
            })
            res.redirect("/login")
        })
        .catch(err => {
            res.render("regis", { error: "User Already Registered" })
        })
    }
})

})
app.get("/activateaccount/:id",(req,res)=>{
    let username=req.params.id; 
    userModel.updateOne({_id:username},{$set:{status:1}},(err)=>{
        if(err){ console.log("Error")}
        else {
            res.render("login",{sucMsg:"Account Activated"});
        }
    })

})
//for render the page of reset passoword
app.get("/resetpass",(req,res)=>{
    res.render("reset");
})
app.get("/welcome", async(req, res) => {
    //let username=req.cookies.username;
    let uname=req.query.uname;
    let datawel= await userModel.findOne({username:uname})
    let username = req.session.username;
    console.log(datawel)
    if (username) {
        return res.render("welcome", {username:username,image:datawel.image})
    }
    else {
        return res.redirect("/login");
    }
})
app.get("/resetpassword",(req,res)=>{//mail side data get
    res.render("resetaccount",{uid:req.query.id,token:req.query.token})
})
app.post("/postresetpassword",async(req,res)=>{
    let {id,token,password}=req.body;
    let tokenpass=await tokenModel.findOne({userId:id})
    if(!tokenpass){
        res.send("Token is expired");
    }
    const isvalid=await bcrypt.compare(token,tokenpass.token)
    if(!isvalid){
        res.send("token Expired and agin reset your password");
    }
    const hash=await bcrypt.hash(password,Number(saltRounds));
    await userModel.updateOne({
        _id:id},{$set:{password:hash}},{new:true}
    );
    return res.render("login",{succMsg:"Password Changed"})
})
app.post("/postreset",async (req,res)=>{
    let {email}=req.body;
    let user=await userModel.findOne({email:email})
    if(user){
        let token=await tokenModel.findOne({userId:user._id})
        if(token) await tokenModel.deleteOne();
        let resttoken=crypto.randomBytes(32).toString("hex");
        const hash=await bcrypt.hash(resttoken,Number(saltRounds));
        await new tokenModel({
            userId:user._id,
            token:hash,
            createdAt:Date.now()
        }).save();
        let mailOptions={
            from:'vrushabhbhuse1020@gmail.com',
            to:['vrushabhbhuse1020@gmail.com'],
            subject:"Reset Password",
            template:'reset',
            context:{email:email,_id:user._id,token:resttoken
            }
        }
        transporter.sendMail(mailOptions,(err,info)=>{
            if(err){ console.log(err)}
            else{
                 console.log("Mail send : "+info)
                 res.send("Mail send");
            }
        })
    }
    else{
        res.send("Email is not exists");
    } 
    
})
app.get("/logout", (req, res) => {
    //res.clearCookie("username");
   // res.clearCookie('connect.sid');
    req.session.destroy((err) => {
        res.clearCookie('connect.sid');//it is clear the cookie after logout
        res.redirect("/");// will always fire after session is destroyed
      })
})
app.get("/delete/:uname",(req,res)=>{
    let uname=req.params.uname;
   userModel.findOneAndDelete({username:uname},(err)=>{
    if (err) throw err;
    else
    res.render("login",{error:"YOUR PROFILE IS DELELTE"})
   })
})
app.get("*",(req,res)=>{
    res.render("404");
})
app.listen(PORT, (err) => {
    if (err) throw err
    else {
        console.log(`Server work on ${PORT}`)
    }
})
