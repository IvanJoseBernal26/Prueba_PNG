// 1. Invocamos a express
const express = require ("express");
const app = express();

const moment = require("moment");

// 2. Se setea urlencoded para capurar los datos del formulario
app.use(express.urlencoded({extended:false}));
app.use(express.json());

// 3. Invocamos a las variables de entorno
const dotenv = require ("dotenv");
dotenv.config({path: "./env/.env"}, { async:true });

// 4. Usamos los recursos de public
app.use("/resource", express.static("public"));
app.use("/resource", express.static(__dirname + "/public"));

// 5. Motor de plantillas
app.set("view engine", "ejs");

// 6. Encriptar constraseñas
const bcryptjs = require ("bcryptjs");

// 7. Variables de session
const session = require("express-session");
app.use(session({
    secret: "12345",
    resave: true,
    saveUninitialized: true
}));

// 8. Invocamos la conexion
const conexion = require("./database/db");

app.get('/login',(req, res)=>{
    res.render('login');
})

app.get('/delete',(req, res)=>{
    res.render('delete');
})

app.get('/register',(req, res)=>{
    res.render('register');
})

app.post("/register", async (req, res) => {
    const user = req.body.user;
    const nombre = req.body.nombre;
    const apellido = req.body.apellido;
    const num_identificacion = req.body.num_identificacion;
    const telefono = req.body.telefono;
    const correo = req.body.correo;
    const pass = req.body.pass;
    const rol = req.body.rol;

    let passEncrypt = await bcryptjs.hash(pass, 8);

    conexion.query("SELECT ID FROM USERS WHERE NO_IDENTIFICACION = " + num_identificacion ,
        async (err, result) => {
            if(result != "") {
                return res.render("register", {
                    alert: true,
                    alertTitle: "Error",
                    alertMessage: "Ya existe un usuario con este numero de identificacion",
                    alertIcon: "error",
                    showConfimButton: false,
                    timer: 2500
                })
            }
    })

    conexion.query("INSERT INTO USERS SET ? ", {
        user: user, 
        nombres: nombre, 
        apellidos: apellido, 
        no_identificacion: num_identificacion, 
        telefono: telefono, 
        correo: correo,
        contraseña: passEncrypt,
        rol: rol}, async(err, result) => {
            if(err){
                res.send("Hubo un error al tratar de ejecutar el insert" + err);
            } else {
                return res.render("register", {
                    alert: true,
                    alertTitle: "Correcto",
                    alertMessage: "Registrado correctamente",
                    alertIcon: "success",
                    showConfimButton: false,
                })
            }
        })
})

app.post("/auth", async (req, res) => {
    const user = req.body.user;
    const pass = req.body.pass;

    let passEncrypt = await bcryptjs.hash(pass, 8);

    if(user && pass){
        conexion.query("SELECT * FROM USERS WHERE USER = ?", [user], async(err, succ) => {
            if(succ.length == 0 || !(await bcryptjs.compare(pass, succ[0].contraseña)) ) {
                return res.render("login", {
                    alert: true,
                    alertTitle: "Error",
                    alertMessage: "Usuario o contraseña incorreta!",
                    alertIcon: "error",
                    showConfimButton: false,
                    timer: 5000
                })
            } else {
                req.session.loggedin = true;
                req.session.user = succ[0].user;
                req.session.rol = succ[0].rol;
                req.session.id_user = succ[0].id;
                return res.render("login", {
                    alert: true,
                    alertTitle: "Iniciando sesion...",
                    alertMessage: "",
                    alertIcon: "success",
                    showConfimButton: false,
                })
            }
        })
    } else {
        return res.render("login", {
            alert: true,
            alertTitle: "Advertencia",
            alertMessage: "Por favor ingrese un usuario y/o contraseña!",
            alertIcon: "warning",
            showConfimButton: false,
            timer: 5000
        })
    }
})

app.get('/visualizarPagos', (req, res)=> {

    const id = req.session.id_user;
    const rol = req.session.rol;

	if (req.session.loggedin) {
        if(rol == 1){
            conexion.query("SELECT p.id, u.user, u.nombres, u.apellidos, p.tipo_pago, p.valor, p.descripcion, p.fecha_reg FROM pagos p INNER JOIN users u ON u.id = p.id_cliente ORDER BY p.id", async(err, succ) => {
            if(err){
                console.log("Hubo error")
            } else {
                console.log("Rol 1" + JSON.stringify(succ));
                res.render('visualizarPagos',{
                    autorizado: true,
                    name: req.session.user,
                    rol: req.session.rol == "" ? 0 : req.session.rol,
                    id_user: req.session.id_user,
                    data: succ,
                    moment: moment
                });
            }
        });
        } else if(rol == 2) {
             conexion.query("SELECT p.id, u.user, u.nombres, u.apellidos, p.tipo_pago, p.valor, p.descripcion, p.fecha_reg FROM pagos p INNER JOIN users u ON u.id = p.id_cliente WHERE p.id_cliente = ? ORDER BY p.id", [id], async(err, succ) => {
                if (err) {
                    console.log("Hubo error")
                } else {
                    res.render('visualizarPagos',{
                        autorizado: true,
                        name: req.session.user,
                        rol: req.session.rol == "" ? 0 : req.session.rol,
                        id_user: req.session.id_user,
                        data: succ,
                        moment: moment
                    });
                }
             })
         }
	}
});

app.get('/registrarPagos', (req, res)=> {
	if (req.session.loggedin) {
        conexion.query("SELECT * FROM USERS", async(err, succ) => {
            if(err){
                console.log("Hubo error")
            } else {
                res.render('registrarPagos', {
                    autorizado: true,
                    showConfimButton: false,
                    name: req.session.user,
                    rol: req.session.rol == "" ? 0 : req.session.rol,
                    id_user: req.session.id_user,
                    data: succ
                });	
            }
         })
	}
});

app.post("/registrarPagos", (req, res) => {

    const descripcion = req.body.descripcion;
    const tipo_pago = req.body.tipo_pago;
    const valor = req.body.valor;
    const imagen = req.body.imagen;
    const cliente = req.body.cliente;
    const id_user = req.session.id_user;
    const rol = req.session.rol;
    
    conexion.query("INSERT INTO PAGOS SET ? ", {
        id_user: id_user,
        id_cliente: cliente,
        tipo_pago: tipo_pago,
        valor: valor,
        volante_pago: imagen, 
        descripcion: descripcion}, async(err, result) => {
            if(err){
                res.send("Hubo un error al tratar de ejecutar el insert" + err);
            } else {
                conexion.query("SELECT * FROM USERS", async(err, succ) => {
                    if(err){
                        console.log("Hubo error")
                    } else {
                        return res.render('registrarPagos', {
                            autorizado: true,
                            rol: rol,
                            alert: true,
                            alertTitle: "Correcto",
                            alertMessage: "Registrado correctamente",
                            alertIcon: "success",
                            showConfimButton: false,
                            name: req.session.user,
                            rol: req.session.rol == "" ? 0 : req.session.rol,
                            id_user: req.session.id_user,
                            data: succ
                        });	
                    }
                 })
            }
    })
})

app.get('/delete/:id', (req, res)=> {
    const id_pago = req.params.id;

    const id = req.session.id_user;
    const rol = req.session.rol;

    if (req.session.loggedin) {
        conexion.query("DELETE FROM PAGOS WHERE ID = " + id_pago, async(err, succ) => {
            if(err){
                console.log("Hubo error" + err)
            } else {
                    if(rol == 1){
                        conexion.query("SELECT p.id, u.user, u.nombres, u.apellidos, p.tipo_pago, p.valor, p.descripcion, p.fecha_reg FROM pagos p INNER JOIN users u ON u.id = p.id_cliente ORDER BY p.id", async(err, success) => {
                        if(err){
                            console.log("Hubo error")
                        } else {
                            res.render('visualizarPagos', {
                                autorizado: true,
                                showConfimButton: false,
                                name: req.session.user,
                                rol: req.session.rol == "" ? 0 : req.session.rol,
                                id_user: req.session.id_user,
                                alert: true,
                                alertTitle: "Correcto",
                                alertMessage: "Eliminado correctamente",
                                alertIcon: "success",
                                data: success,
                                moment: moment
                            });
                        }
                    });
                     } else if(rol == 2) {
                         conexion.query("SELECT p.id, u.user, u.nombres, u.apellidos, p.tipo_pago, p.valor, p.descripcion, p.fecha_reg FROM pagos p INNER JOIN users u ON u.id = p.id_cliente WHERE p.id_cliente = ? ORDER BY p.id", [id], async(err, success) => {
                            if (err) {
                                console.log("Hubo error")
                            } else {
                                res.render('visualizarPagos', {
                                    autorizado: true,
                                    showConfimButton: false,
                                    name: req.session.user,
                                    rol: req.session.rol == "" ? 0 : req.session.rol,
                                    id_user: req.session.id_user,
                                    alert: true,
                                    alertTitle: "Correcto",
                                    alertMessage: "Eliminado correctamente",
                                    alertIcon: "success",
                                    data: success,
                                    moment: moment
                                });
                            }
                         })
                     }
            }
         })
	}

});

app.get('/inicio', (req, res)=> {
	if (req.session.loggedin) {
		res.render('inicio', {
			login: true,
			name: req.session.user,
            rol: req.session.rol == "" ? 0 : req.session.rol,
            id: req.session.id	
		});		
	} else {
		res.render('inicio', {
			login: false,
            name: "Por favor inicia sesion",
            rol: req.session.rol == "" ? 0 : req.session.rol,
		});				
	}
});

app.use(function(req, res, next) {
    if (!req.user)
        res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    next();
});

app.get('/logout', function (req, res) {
	req.session.destroy(() => {
	  res.redirect('/login')
	})
});

app.listen(3000, (req, res) => {
    console.log("Servidor iniciado");
})