import { AdminController } from '../controllers/AdminController.js';

export const AdminView = {
    html: `
        <div class="adm-god-mode">
            
            <div class="adm-topbar">
                <div class="adm-logo"><i class="fa-solid fa-satellite-dish"></i> SYS_RADAR V3</div>
                
                <div class="adm-stats-row" id="admTopStats"></div>

                <button class="adm-btn-exit" id="admBtnExit"><i class="fa-solid fa-arrow-right-from-bracket"></i> Вернуться в Cycle</button>
            </div>

            <div class="adm-workspace">
                
                <div class="adm-left-panel">
                    <div class="adm-search-header">
                        <div class="adm-search-input-wrapper" style="position: relative; overflow: visible;">
                            <i class="fa-solid fa-magnifying-glass"></i>
                            <input type="text" id="adminSearchInput" class="adm-search-input" placeholder="Искать узел..." autocomplete="off">
                            <div id="adminSearchDropdown" class="search-dropdown-menu" style="display: none; top: calc(100% + 8px);"></div>
                        </div>
                    </div>
                    <div id="adminSearchList" class="adm-user-list"></div>
                </div>

                <div class="adm-radar-container" id="adminRadarContainer">
                    <canvas id="adminRadarCanvas" style="width:100%; height:100%; display:block;"></canvas>
                </div>

                <!-- ОБНОВЛЕННАЯ ПРАВАЯ ПАНЕЛЬ С ЖЕСТКОЙ СТРУКТУРОЙ -->
                <div id="admRightPanel" class="adm-right-panel">
                    <div id="admDossierHeader" class="adm-ds-sticky-header"></div>
                    <div id="admDossierBody" class="adm-ds-scroll-body"></div>
                </div>

            </div>

        </div>
    `,
    Manager: AdminController
};