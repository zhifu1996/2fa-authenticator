<template>
  <div>
    <!-- 登录表单 -->
    <div v-if="!isLoggedIn" class="max-w-sm mx-auto">
      <h2 class="text-xl font-bold mb-4 text-center">管理员登录</h2>
      <form @submit.prevent="handleLogin" class="space-y-4">
        <div>
          <input
            v-model="password"
            type="password"
            placeholder="请输入管理员密码"
            class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div v-if="loginError" class="text-red-500 text-sm">{{ loginError }}</div>
        <button
          type="submit"
          :disabled="loginLoading"
          class="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {{ loginLoading ? '登录中...' : '登录' }}
        </button>
      </form>
    </div>

    <!-- 管理后台 -->
    <div v-else>
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-bold">账号管理</h2>
        <div class="flex gap-2">
          <button
            @click="showAddForm = true"
            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            添加账号
          </button>
          <button
            @click="handleLogout"
            class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm"
          >
            退出
          </button>
        </div>
      </div>

      <!-- 账号列表 -->
      <div v-if="loading" class="text-center py-8 text-gray-500">加载中...</div>
      <div v-else-if="accounts.length === 0" class="text-center py-8 text-gray-500">
        暂无账号
      </div>
      <div v-else class="space-y-2">
        <div
          v-for="(account, index) in accounts"
          :key="account.id"
          class="flex items-center gap-3 p-3 bg-white rounded-lg shadow-sm"
        >
          <div class="flex flex-col gap-1">
            <button
              @click="moveUp(index)"
              :disabled="index === 0"
              class="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"/>
              </svg>
            </button>
            <button
              @click="moveDown(index)"
              :disabled="index === accounts.length - 1"
              class="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
              </svg>
            </button>
          </div>
          <div class="flex-1">
            <div class="font-medium">{{ account.name }}</div>
            <div class="text-sm text-gray-500">{{ account.issuer }} - {{ account.secret }}</div>
          </div>
          <div class="flex gap-2">
            <button
              @click="editAccount(account)"
              class="p-2 text-blue-600 hover:bg-blue-50 rounded"
            >
              编辑
            </button>
            <button
              @click="handleDelete(account.id)"
              class="p-2 text-red-600 hover:bg-red-50 rounded"
            >
              删除
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 添加/编辑弹窗 -->
    <div
      v-if="showAddForm || editingAccount"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      @mousedown.self="closeForm"
    >
      <div class="bg-white rounded-lg p-6 w-full max-w-md" @mousedown.stop>
        <h3 class="text-lg font-bold mb-4">{{ editingAccount ? '编辑账号' : '添加账号' }}</h3>
        <form @submit.prevent="handleSubmit" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">账号名称</label>
            <input
              v-model="form.name"
              type="text"
              required
              placeholder="例如: Google - work@company.com"
              class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">发行方 (Issuer)</label>
            <input
              v-model="form.issuer"
              type="text"
              placeholder="例如: Google, GitHub, AWS"
              class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">密钥 (Secret)</label>
            <input
              v-model="form.secret"
              type="text"
              required
              placeholder="Base32 编码密钥"
              class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
          </div>
          <div v-if="formError" class="text-red-500 text-sm">{{ formError }}</div>
          <div class="flex gap-3 pt-2">
            <button
              type="button"
              @click="closeForm"
              class="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              取消
            </button>
            <button
              type="submit"
              :disabled="formLoading"
              class="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {{ formLoading ? '保存中...' : '保存' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import {
  login,
  logout,
  getToken,
  getAdminAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
  reorderAccounts,
  type Account,
} from '../utils/api';

const password = ref('');
const loginLoading = ref(false);
const loginError = ref('');
const isLoggedIn = ref(!!getToken());

const accounts = ref<Account[]>([]);
const loading = ref(true);

const showAddForm = ref(false);
const editingAccount = ref<Account | null>(null);
const form = ref({
  name: '',
  issuer: '',
  secret: '',
});
const formLoading = ref(false);
const formError = ref('');

async function handleLogin() {
  loginLoading.value = true;
  loginError.value = '';
  try {
    await login(password.value);
    password.value = '';
    isLoggedIn.value = true;
    await fetchAccounts();
  } catch (e) {
    loginError.value = (e as Error).message;
  } finally {
    loginLoading.value = false;
  }
}

function handleLogout() {
  logout();
  isLoggedIn.value = false;
  accounts.value = [];
}

async function fetchAccounts() {
  loading.value = true;
  try {
    accounts.value = await getAdminAccounts();
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
}

function editAccount(account: Account) {
  editingAccount.value = account;
  form.value = {
    name: account.name,
    issuer: account.issuer,
    secret: account.secret,
  };
}

function closeForm() {
  showAddForm.value = false;
  editingAccount.value = null;
  form.value = { name: '', issuer: '', secret: '' };
  formError.value = '';
}

async function handleSubmit() {
  formLoading.value = true;
  formError.value = '';
  try {
    if (editingAccount.value) {
      await updateAccount(editingAccount.value.id, form.value);
    } else {
      await createAccount(form.value);
    }
    closeForm();
    await fetchAccounts();
  } catch (e) {
    formError.value = (e as Error).message;
  } finally {
    formLoading.value = false;
  }
}

async function handleDelete(id: string) {
  if (!confirm('确定要删除这个账号吗？')) return;
  try {
    await deleteAccount(id);
    await fetchAccounts();
  } catch (e) {
    alert((e as Error).message);
  }
}

async function moveUp(index: number) {
  if (index === 0) return;
  const ids = accounts.value.map((a) => a.id);
  [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]];
  await reorderAccounts(ids);
  await fetchAccounts();
}

async function moveDown(index: number) {
  if (index === accounts.value.length - 1) return;
  const ids = accounts.value.map((a) => a.id);
  [ids[index], ids[index + 1]] = [ids[index + 1], ids[index]];
  await reorderAccounts(ids);
  await fetchAccounts();
}

onMounted(() => {
  if (isLoggedIn.value) {
    fetchAccounts();
  } else {
    loading.value = false;
  }
});
</script>
