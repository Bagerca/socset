const express = require('express');
const router = express.Router();
const CommunitiesController = require('../controllers/communities.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');

router.get('/', authenticateToken, CommunitiesController.getAll);
router.post('/create', authenticateToken, CommunitiesController.create);
router.post('/join', authenticateToken, CommunitiesController.toggleJoin);
router.post('/update', authenticateToken, CommunitiesController.update);
router.post('/delete', authenticateToken, CommunitiesController.delete); // НОВЫЙ РОУТ
router.get('/:handle', authenticateToken, CommunitiesController.getOne);

module.exports = router;