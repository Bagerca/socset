// public/js/views/AdminView.js
import { AdminController } from '../controllers/AdminController.js';

export const AdminView = {
    html: `
        <div class="adm-god-mode">
            
            <!-- Верхняя панель -->
            <div class="adm-topbar">
                <div class="adm-logo"><i class="fa-solid fa-satellite-dish"></i> SYS_RADAR V3</div>
                
                <div class="adm-stats-row" id="admTopStats">
                    <!-- Заполняется из JS -->
                </div>

                <button class="adm-btn-exit" id="admBtnExit"><i class="fa-solid fa-arrow-right-from-bracket"></i> Вернуться в Cycle</button>
            </div>

            <!-- Рабочая область -->
            <div class="adm-workspace">
                
                <!-- Левая панель (Поиск) -->
                <div class="adm-left-panel">
                    <div class="adm-search-header">
                        <div class="adm-search-input-wrapper">
                            <i class="fa-solid fa-magnifying-glass"></i>
                            <input type="text" id="adminSearchInput" class="adm-search-input" placeholder="Искать узел...">
                        </div>
                    </div>
                    <div id="adminSearchList" class="adm-user-list"></div>
                </div>

                <!-- Центр (Радар) -->
                <div class="adm-radar-container">
                    <canvas id="adminRadarCanvas" style="width:100%; height:100%; display:block;"></canvas>
                </div>

                <!-- Правая панель (Выезжающее досье) -->
                <div id="admRightPanel" class="adm-right-panel">
                    <div id="admDossierContent" class="adm-dossier-scroll"></div>
                </div>

            </div>

        </div>
    `,
    Manager: AdminController
};