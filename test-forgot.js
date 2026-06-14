require('dotenv').config();
const sendEmail = require('./src/utils/email');

async function test() {
  try {
    const res = await sendEmail({
      to: 'm_saad5551@yahoo.com', // random email or their email
      subject: 'Test Email',
      html: '<p>Hello</p>'
    });
    console.log("SUCCESS:", res);
  } catch (err) {
    console.error("FAILED:");
    console.error(err);
  }
}
test();
