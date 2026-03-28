// server/services/CommunityService.js
const CommunityRepository = require('../repositories/CommunityRepository');
const { randomUUID } = require('crypto');

class CommunityService {
    getAll(query, currentUserUsername) {
        let communities = query 
            ? CommunityRepository.searchCommunities(query) 
            : CommunityRepository.getAllCommunities();

        return communities.map(c => {
            const isMember = CommunityRepository.isMember(c.id, currentUserUsername);
            return { ...c, isMember: !!isMember };
        });
    }

    getOne(handle, user) {
        const community = CommunityRepository.findByHandle(handle);
        if (!community) throw { status: 404, message: 'Community not found' };

        const membersCount = CommunityRepository.getMembersCount(community.id);
        
        let isMember = false;
        let role = null;
        
        if (user) {
            const memberData = CommunityRepository.getMemberRole(community.id, user.username);
            if (memberData) {
                isMember = true;
                role = memberData.role;
            }
        }

        const isCreator = community.creator_username === (user ? user.username : null);

        return { ...community, membersCount, isMember, role, isCreator };
    }

    create(handle, name, description, user) {
        if (!handle || !name) throw { status: 400, message: 'Заполните обязательные поля' };
        
        handle = handle.trim().toLowerCase();
        name = name.trim();
        
        if (handle.length < 3 || handle.length > 20) throw { status: 400, message: 'Адрес должен быть от 3 до 20 символов' };
        if (!/^[a-z0-9_]+$/.test(handle)) throw { status: 400, message: 'Адрес может содержать только латинские буквы, цифры и _' };
        if (name.length < 3 || name.length > 30) throw { status: 400, message: 'Название должно быть от 3 до 30 символов' };

        const exists = CommunityRepository.checkHandleExists(handle);
        if (exists) throw { status: 400, message: 'Этот адрес уже занят' };

        const newCommunity = {
            id: randomUUID(),
            handle: handle,
            name,
            description: description ? description.slice(0, 200) : '',
            avatar: 'img/logo.svg',
            banner: 'img/logo.svg',
            creator_username: user.username,
            created_at: Date.now()
        };

        CommunityRepository.createCommunityTransaction(newCommunity, user.username);
        return newCommunity;
    }

    update(communityId, name, description, avatar, banner, user) {
        const member = CommunityRepository.getMemberRole(communityId, user.username);
        
        if (!member || member.role !== 'admin') {
            if (!user.isAdmin) throw { status: 403, message: 'У вас нет прав на редактирование' };
        }

        if (!name || name.trim().length < 3) throw { status: 400, message: 'Некорректное название' };

        CommunityRepository.updateCommunity(communityId, name.trim(), description || '', avatar, banner);
    }

    toggleJoin(communityId, user) {
        if (!communityId) throw { status: 400, message: 'No community ID' };

        const exists = CommunityRepository.isMember(communityId, user.username);
        const community = CommunityRepository.findById(communityId);

        let status = '';
        if (exists) {
            if (community && community.creator_username === user.username) {
                throw { status: 400, message: 'Создатель не может покинуть свое сообщество' };
            }
            CommunityRepository.removeMember(communityId, user.username);
            status = 'left';
        } else {
            const role = (community && community.creator_username === user.username) ? 'admin' : 'member';
            CommunityRepository.addMember(communityId, user.username, role);
            status = 'joined';
        }

        const membersCount = CommunityRepository.getMembersCount(communityId);
        return { status, membersCount };
    }

    delete(communityId, user) {
        const comm = CommunityRepository.findById(communityId);
        if (!comm) throw { status: 404, message: 'Not found' };
        
        if (comm.creator_username !== user.username && !user.isAdmin) {
            throw { status: 403, message: 'Forbidden' };
        }

        CommunityRepository.deleteCommunityCascade(communityId);
    }
}

module.exports = new CommunityService();