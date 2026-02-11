import User from '../models/user.js';
import Professional from '../models/Professional.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const SALT_ROUNDS = 10;

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

export const registerUser = async (req, res) => { 
    const { username, email, password, telefono, fechaNacimiento } = req.body;

    // Validación de entrada: Evitar crash si faltan datos
    if (!username || !email || !password) {
        return res.status(400).json({ message: 'Faltan datos obligatorios (username, email, password).' });
    }

    try {
        // Asignamos a una constante para asegurar que el valor existe
        const secret = process.env.JWT_SECRET;
        if (!secret) throw new Error("JWT_SECRET no configurado en el servidor.");

        const sanitizedEmail = email ? email.toLowerCase().trim() : '';
        const existingUser = await User.findOne({ email: sanitizedEmail });
        if (existingUser) {
            return res.status(400).json({ message: 'El email ya está registrado.' });
        }

        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        // Verificar si el email corresponde a un profesional registrado por el admin
        const professional = await Professional.findOne({ email: sanitizedEmail });
        const role = professional ? 'professional' : 'client';

        const newUser = new User({
            username,
            email: sanitizedEmail,
            password: hashedPassword,
            telefono,
            fechaNacimiento,
            role // 'professional' si existe en la lista, sino 'client'
        });

        await newUser.save();

        // Generar token también en el registro para auto-login
        const token = jwt.sign({ id: newUser._id, role: newUser.role }, secret, {
            expiresIn: '24h'
        });

        res.status(201).json({
            message: 'Usuario registrado con éxito.',
            user: {
                _id: newUser._id,
                username: newUser.username,
                email: newUser.email,
                telefono: newUser.telefono,
                role: newUser.role,
                avatar: newUser.avatar,
                fechaNacimiento: newUser.fechaNacimiento,
                isGoogleCalendarLinked: false
            },
            token
        });
    } catch (error) {
        console.error("Error en registerUser:", error);
        res.status(500).json({ message: 'Error al registrar el usuario.', error: error.message });
    }
};

export const loginUser = async (req, res) => {
    const { email, password, identifier } = req.body;
    // identifier puede ser email, username o telefono
    const loginId = identifier || email;

    if (!loginId) {
        return res.status(400).json({ message: 'Por favor ingrese usuario, email o teléfono.' });
    }

    try {
        const sanitizedId = loginId.toLowerCase().trim();
        
        // Buscar por email, username o teléfono
        const user = await User.findOne({
            $or: [
                { email: sanitizedId },
                { username: { $regex: new RegExp(`^${sanitizedId}$`, 'i') } }, // Case insensitive username
                { telefono: sanitizedId }
            ]
        });

        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Contraseña incorrecta.' });
        }

        const secret = process.env.JWT_SECRET;
        if (!secret) throw new Error("JWT_SECRET no configurado en el servidor.");

        const token = jwt.sign({ id: user._id, role: user.role }, secret, {
            expiresIn: '24h'
        });

        res.json({
            message: 'Inicio de sesión exitoso.',
            user: {
                _id: user._id,
                username: user.username,
                email: user.email,
                telefono: user.telefono,
                role: user.role,
                avatar: user.avatar,
                fechaNacimiento: user.fechaNacimiento,
                isGoogleCalendarLinked: !!user.googleCalendarTokens
            },
            token
        });
    } catch (error) {
        console.error("Error en loginUser:", error);
        res.status(500).json({ message: 'Error al iniciar sesión.', error: error.message });
    }
};

export const setupWhatsappAccount = async (req, res) => {
    const { userId, telefono, password } = req.body;

    try {
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });

        if (!user.isWhatsappUser) {
            return res.status(400).json({ message: 'Esta cuenta ya está configurada.' });
        }

        // Verificar identidad con el teléfono
        if (user.telefono !== telefono) {
            return res.status(400).json({ message: 'El número de teléfono no coincide con el registrado.' });
        }

        // Establecer contraseña y activar usuario
        user.password = await bcrypt.hash(password, SALT_ROUNDS);
        user.isWhatsappUser = false;
        await user.save();

        const secret = process.env.JWT_SECRET;
        const token = jwt.sign({ id: user._id, role: user.role }, secret, { expiresIn: '24h' });

        res.json({
            message: 'Cuenta configurada con éxito.',
            token,
            user: {
                _id: user._id,
                username: user.username,
                role: user.role,
                avatar: user.avatar
            }
        });
    } catch (error) {
        res.status(500).json({ message: 'Error al configurar la cuenta.', error: error.message });
    }
};

export const updateUser = async (req, res) => {
    const { id } = req.params;
    const { username, email, password, telefono, verificationCode, avatar, fechaNacimiento, notes, taggedProducts } = req.body;

    try {
        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        const isSensitiveChange = (email && email !== user.email) || (password && password.trim() !== "");

        if (isSensitiveChange) {
            if (!verificationCode) {
                return res.status(403).json({ message: 'Se requiere código de verificación para cambiar datos sensibles.' });
            }
            if (user.verificationCode !== verificationCode) {
                return res.status(400).json({ message: 'Código de verificación incorrecto o expirado.' });
            }
            user.verificationCode = null;
        }

        if (username) user.username = username;
        if (email) user.email = email;
        if (telefono) user.telefono = telefono;
        
        // Manejo de Avatar con Cloudinary
        if (avatar) {
            // Si es una imagen en base64 (nueva subida)
            if (avatar.startsWith('data:image')) {
                const uploadResponse = await cloudinary.uploader.upload(avatar, {
                    folder: 'salomon_users'
                });
                user.avatar = uploadResponse.secure_url;
            } else {
                // Si es una URL (avatar predefinido o ya existente)
                user.avatar = avatar;
            }
        }

        if (fechaNacimiento) user.fechaNacimiento = fechaNacimiento;
        if (notes !== undefined) user.notes = notes;
        if (taggedProducts !== undefined) user.taggedProducts = taggedProducts;

        if (password) {
            user.password = await bcrypt.hash(password, SALT_ROUNDS);
        }

        await user.save();

        res.json({ message: 'Usuario actualizado con éxito.', user });
    } catch (error) {
        res.status(500).json({ message: 'Error al actualizar el usuario.', error: error.message });
    }
};

export const deleteUser = async (req, res) => {
    const { id } = req.params;
    const { verificationCode } = req.body;

    try {
        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        if (!verificationCode) return res.status(403).json({ message: 'Se requiere código de verificación.' });
        
        if (user.verificationCode !== verificationCode) {
            return res.status(400).json({ message: 'Código de verificación incorrecto o expirado.' });
        }

        await User.findByIdAndDelete(id);
        res.json({ message: 'Usuario eliminado con éxito.' });
    } catch (error) {
        res.status(500).json({ message: 'Error al eliminar el usuario.', error: error.message });
    }
};

export const obtenerUsuarioxId = async (req, res)=> {
    const { id } = req.params;

    try {
        const user = await User.findById(id).populate('taggedProducts');
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }
        
        // Convertir a objeto plano para modificar y proteger datos
        const userObj = user.toObject();
        userObj.isGoogleCalendarLinked = !!userObj.googleCalendarTokens;
        delete userObj.googleCalendarTokens; // No enviar tokens al frontend
        delete userObj.password;

        res.json(userObj);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener el usuario.', error: error.message });
    }
};

export const requestVerificationCode = async (req, res) => {
    const { id } = req.params;
    try {
        const user = await User.findById(id);
        if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        
        user.verificationCode = code;
        await user.save();

        // TODO: Actualizar logo y URL para Salomon Hair Studio
        const logoUrl = "https://via.placeholder.com/150"; 

        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: user.email, // Se envía al correo ACTUAL del usuario
            subject: 'Código de Verificación - Salomon Hair Studio',
            html: `
                <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px; border-bottom: 1px solid #eee; padding-bottom: 10px;">
                        <img src="${logoUrl}" alt="Logo" style="max-height: 40px;" />
                        <span style="font-weight: 700; font-size: 24px; color: #222;">Salomon<span style="color: #FFC43F;">Studio</span></span>
                    </div>
                    <h3>Tu código de seguridad es: <b>${code}</b></h3>
                    <p>Úsalo para confirmar tus cambios de perfil.</p>
                </div>
            `
        });

        res.json({ message: "Código enviado a tu correo actual." });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al enviar el código." });
    }
};

export const forgotPassword = async (req, res) => {
    
    const { email } = req.body;

        try {
            const user = await User.findOne({ email });
            if (!user) {
                return res.status(404).json({ message: "No existe un usuario con ese correo." });
            }

            const secret = process.env.JWT_SECRET + user.password;
            
            const token = jwt.sign({ id: user._id, email: user.email }, secret, { expiresIn: '15m' });

            // Ajustar URL al puerto de Astro (4321)
            const link = `http://localhost:4321/reset-password/${user._id}/${token}`;
            const logoUrl = "https://via.placeholder.com/150";

            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: email,
                subject: 'Restablecer Contraseña - Salomon Hair Studio',
                html: `
                    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px; border-bottom: 1px solid #eee; padding-bottom: 10px;">
                            <img src="${logoUrl}" alt="Logo" style="max-height: 40px;" />
                            <span style="font-weight: 700; font-size: 24px; color: #222;">Salomon<span style="color: #FFC43F;">Studio</span></span>
                        </div>
                        <h2>Recuperación de cuenta</h2>
                        <p>Has solicitado restablecer tu contraseña. Haz clic en el siguiente enlace:</p>
                        <a href="${link}" style="background: #FFC43F; padding: 10px 20px; text-decoration: none; color: white; border-radius: 5px;">Restablecer Contraseña</a>
                        <p>Este enlace expira en 15 minutos.</p>
                    </div>
                `
            };

            await transporter.sendMail(mailOptions);
            res.status(200).json({ message: "Correo enviado. Revisa tu bandeja de entrada." });

        } catch (error) {
            res.status(500).json({ message: "Error al enviar el correo." });
        }
    };

export const resetPassword = async (req, res) => {
        const { id, token } = req.params;
        const { password } = req.body;
        try {
            const user = await User.findById(id);
            if (!user) {
                return res.status(404).json({ message: "Usuario no encontrado." });
            }

            const secret = process.env.JWT_SECRET + user.password;
            
            try {
                const payload = jwt.verify(token, secret);
                
                const salt = await bcrypt.genSalt(10);
                user.password = await bcrypt.hash(password, salt);
                
                await user.save();
                res.status(200).json({ message: "Contraseña actualizada correctamente." });

            } catch (err) {
                return res.status(400).json({ message: "El enlace es inválido o ha expirado." });
            }

        } catch (error) {
            res.status(500).json({ message: "Error al restablecer la contraseña." });
        }
    };
