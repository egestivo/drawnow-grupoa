const mongoose = require('mongoose');
const usuarioSchema = new mongoose.Schema({
username: {
type: String,
required: true,
unique: true,
trim: true
},
password: {
type: String,
required: false
},
googleId: {
type: String,
required: false,
unique: true,
sparse: true
}
}, {
timestamps: true
});
module.exports = mongoose.model('Usuario', usuarioSchema);