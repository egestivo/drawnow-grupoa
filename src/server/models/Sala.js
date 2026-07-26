const mongoose = require('mongoose');
const salaSchema = new mongoose.Schema({
  roomId: { type: Number, required: true, index: true },
  nombre: { type: String, required: true },
  idUsuario: { type: String, required: true }
}, { timestamps: true });
module.exports = mongoose.model('Sala', salaSchema);
