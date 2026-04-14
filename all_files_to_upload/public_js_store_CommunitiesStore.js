import { CommunitiesAPI } from '../api/CommunitiesAPI.js';

export class CommunitiesStore {
    constructor() {
        this.communities =[];
    }

    async load(query = '') {
        try {
            this.communities = await CommunitiesAPI.getAll(query);
            return this.communities;
        } catch (e) {
            return[];
        }
    }

    async create(data) {
        return await CommunitiesAPI.create(data);
    }

    async toggleJoin(communityId) {
        const comm = this.communities.find(c => c.id === communityId);
        const res = await CommunitiesAPI.toggleJoin(communityId);
        
        if (res.success && comm) {
            // Обновляем данные в сторе на основе ответа сервера
            if (res.status === 'joined') {
                comm.isMember = true;
            } else {
                comm.isMember = false;
            }
            comm.membersCount = res.membersCount;
        }
        return res;
    }
}