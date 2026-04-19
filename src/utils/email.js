const nodemailer=require('nodemailer');
const sendEmail=async(options)=>{
    const transport=nodemailer.createTransport({
        host:process.env.EMAIL_HOST,
        port:process.env.EMAIL_PORT,
        auth:{
            user:process.env.EMAIL_USERNAME,
            pass:process.env.EMAIL_PASSWORD
        }
})
const mailContent={
    from:"m@gmail.com",
    to:options.to,
    subject:options.subject,
    text:options.message
}
await transport.sendMail(mailContent);
}
module.exports=sendEmail;