const mongoose=require('mongoose');
const userSchema=new mongoose.Schema({
    username:{
        type:String,
        unique:true,
        required:true,
    },
    email:{
        type:String,
        unique:true,
        required:true,
    },
    password:{
        type:String,
        required:true
    },
    status:{
     type:Number,
    required:true
    },
    image:{
        type:String,
        required:true
    }
});
module.exports=mongoose.model("user",userSchema);