const express = require('express');
const router = express.Router();
const AdminController = require('../controllers/admin.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');
const { isAdmin } = require('../middlewares/admin.middleware');

router.use(authenticateToken, isAdmin);

router.get('/data', AdminController.getAdminData); // Получает юзеров + связи (граф)
router.post('/update_user', AdminController.updateUser);
router.post('/toggle_block', AdminController.toggleBlock);
router.post('/mute', AdminController.muteUser);
router.post('/warn', AdminController.warnUser);
router.post('/remove_warn', AdminController.removeWarning);
router.post('/nuke_user', AdminController.nukeUser);
router.post('/delete_user', AdminController.deleteUser);

module.exports = router;