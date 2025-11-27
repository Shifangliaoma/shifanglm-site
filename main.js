// 本地存储key定义
const STORAGE_KEY = {
    USER_LIST: 'shifanglm_user_list', // 用户列表
    CURRENT_USER: 'shifanglm_current_user' // 当前登录用户
};

// 初始化本地存储（无数据时创建空结构）
function initStorage() {
    if (!localStorage.getItem(STORAGE_KEY.USER_LIST)) {
        localStorage.setItem(STORAGE_KEY.USER_LIST, JSON.stringify([]));
    }
}
initStorage();

// 获取所有用户
function getAllUsers() {
    return JSON.parse(localStorage.getItem(STORAGE_KEY.USER_LIST)) || [];
}

// 保存所有用户
function saveAllUsers(users) {
    localStorage.setItem(STORAGE_KEY.USER_LIST, JSON.stringify(users));
}

// 获取当前登录用户
function getCurrentUser() {
    return JSON.parse(localStorage.getItem(STORAGE_KEY.CURRENT_USER)) || null;
}

// 保存当前登录用户
function saveCurrentUser(user) {
    localStorage.setItem(STORAGE_KEY.CURRENT_USER, JSON.stringify(user));
}

// 退出登录
function logout() {
    localStorage.removeItem(STORAGE_KEY.CURRENT_USER);
    window.location.href = 'index.html';
}

// 权限判断：未登录跳转登录页
function checkLogin() {
    const user = getCurrentUser();
    if (!user) {
        alert('请先登录');
        window.location.href = 'login.html';
        return false;
    }
    return user;
}

// 权限判断：非会员/未充值禁止访问工具
function checkVip() {
    const user = checkLogin();
    if (!user || user.score <= 0) {
        alert('需注册会员并充值后使用');
        window.location.href = 'user-center.html';
        return false;
    }
    return true;
}

// 后台权限判断（固定admin账号，密码admin123）
function checkAdmin() {
    const user = checkLogin();
    if (user.username !== 'admin' || user.password !== 'admin123') {
        alert('无后台访问权限');
        window.location.href = 'index.html';
        return false;
    }
    return true;
}

// 登录逻辑
if (document.getElementById('loginForm')) {
    document.getElementById('loginForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value.trim();
        const users = getAllUsers();
        
        // 匹配用户
        const user = users.find(u => u.username === username && u.password === password);
        if (user) {
            if (user.isBanned) {
                alert('账号已被封禁，无法登录');
                return;
            }
            saveCurrentUser(user);
            alert('登录成功');
            window.location.href = 'index.html';
        } else {
            alert('用户名或密码错误');
        }
    });
}

// 注册逻辑
if (document.getElementById('registerForm')) {
    document.getElementById('registerForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const username = document.getElementById('regUsername').value.trim();
        const password = document.getElementById('regPassword').value.trim();
        const confirmPwd = document.getElementById('regConfirmPwd').value.trim();
        const users = getAllUsers();

        // 校验规则
        if (username.length < 3 || username.length > 10) {
            alert('用户名需3-10位');
            return;
        }
        if (password.length < 6 || password.length > 16) {
            alert('密码需6-16位');
            return;
        }
        if (password !== confirmPwd) {
            alert('两次密码不一致');
            return;
        }
        if (users.some(u => u.username === username)) {
            alert('用户名已存在');
            return;
        }

        // 新增用户（默认积分0，未封禁）
        const newUser = {
            username,
            password,
            score: 0, // 虚拟积分
            isBanned: false // 是否封禁
        };
        users.push(newUser);
        saveAllUsers(users);
        alert('注册成功，可登录使用');
        window.location.href = 'login.html';
    });
}

// 用户中心逻辑
if (document.getElementById('userScore')) {
    // 校验登录状态
    const user = checkLogin();
    if (user) {
        // 渲染用户信息
        document.getElementById('username').textContent = user.username;
        document.getElementById('userScore').textContent = user.score;
    }

    // 退出登录
    if (document.getElementById('logoutBtn')) {
        document.getElementById('logoutBtn').onclick = logout;
    }

    // 打开充值弹窗
    if (document.getElementById('rechargeLink')) {
        document.getElementById('rechargeLink').onclick = () => {
            document.getElementById('rechargeModal').style.display = 'flex';
        };
    }

    // 进入工具中心（校验权限）
    if (document.getElementById('goToolBtn')) {
        document.getElementById('goToolBtn').onclick = () => {
            if (checkVip()) {
                window.location.href = 'tools.html';
            }
        };
    }
}

// 工具页逻辑
if (document.querySelector('.tool-item.active')) {
    // 校验会员权限
    checkVip();
    // 退出登录
    if (document.getElementById('logoutBtn')) {
        document.getElementById('logoutBtn').onclick = logout;
    }
}

// 首页逻辑
if (document.getElementById('loginBtn')) {
    // 登录状态切换（显示用户名/退出）
    const user = getCurrentUser();
    const loginBtn = document.getElementById('loginBtn');
    const userLink = document.getElementById('userLink');
    if (user) {
        loginBtn.innerHTML = '<span class="icon icon-login"></span> 退出登录';
        loginBtn.onclick = logout;
        userLink.innerHTML = `<span class="icon icon-user"></span> 我的账户（${user.username}）`;
    } else {
        loginBtn.onclick = () => window.location.href = 'login.html';
    }
}

// 后台管理逻辑
if (document.getElementById('userTableBody')) {
    // 校验管理员权限
    checkAdmin();

    // 渲染用户列表
    function renderUserList() {
        const users = getAllUsers();
        const tableBody = document.getElementById('userTableBody');
        tableBody.innerHTML = '';
        users.forEach(user => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${user.username}</td>
                <td>${user.score}</td>
                <td>${user.isBanned ? '已封禁' : '正常'}</td>
                <td>
                    <button class="btn btn-primary" onclick="openRechargeModal('${user.username}')">充值积分</button>
                    <button class="btn btn-danger" style="margin-left: 10px;" onclick="toggleBan('${user.username}')">${user.isBanned ? '解封' : '封禁'}</button>
                </td>
            `;
            tableBody.appendChild(tr);
        });
    }
    renderUserList();

    // 打开充值弹窗
    window.openRechargeModal = function(username) {
        document.getElementById('rechargeUsername').value = username;
        document.getElementById('showUsername').value = username;
        document.getElementById('rechargeNum').value = '';
        document.getElementById('rechargeModal').style.display = 'flex';
    }

    // 关闭充值弹窗
    window.closeRechargeModal = function() {
        document.getElementById('rechargeModal').style.display = 'none';
    }

    // 提交充值
    window.submitRecharge = function() {
        const username = document.getElementById('rechargeUsername').value;
        const num = parseInt(document.getElementById('rechargeNum').value);
        if (!num || num < 1) {
            alert('请输入有效积分数量');
            return;
        }
        const users = getAllUsers();
        const index = users.findIndex(u => u.username === username);
        if (index !== -1) {
            users[index].score += num;
            saveAllUsers(users);
            // 更新当前登录用户积分（若充值的是当前登录用户）
            const currentUser = getCurrentUser();
            if (currentUser && currentUser.username === username) {
                saveCurrentUser(users[index]);
            }
            alert('充值成功');
            closeRechargeModal();
            renderUserList();
        }
    }

    // 封禁/解封用户
    window.toggleBan = function(username) {
        const users = getAllUsers();
        const index = users.findIndex(u => u.username === username);
        if (index !== -1) {
            users[index].isBanned = !users[index].isBanned;
            saveAllUsers(users);
            // 若封禁的是当前登录用户，强制退出
            const currentUser = getCurrentUser();
            if (currentUser && currentUser.username === username && users[index].isBanned) {
                logout();
            }
            renderUserList();
        }
    }

    // 退出登录
    if (document.getElementById('logoutBtn')) {
        document.getElementById('logoutBtn').onclick = logout;
    }
}
