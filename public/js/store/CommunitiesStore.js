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
        if (comm) {
            // Оптимистичное обновление UI
            comm.isMember = !comm.isMember;
            comm.membersCount += comm.isMember ? 1 : -1;
        }
        await CommunitiesAPI.toggleJoin(communityId);
    }
}