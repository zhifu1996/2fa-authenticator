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
            v-if="selectedIds.size > 0"
            @click="handleBatchDelete"
            class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
          >
            删除 ({{ selectedIds.size }})
          </button>
          <button
            v-if="selectedIds.size > 0"
            @click="handleBatchSetPublic(true)"
            class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
          >
            设为公开
          </button>
          <button
            v-if="selectedIds.size > 0"
            @click="handleBatchSetPublic(false)"
            class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm"
          >
            设为隐私
          </button>
          <button
            @click="showExportForm = true"
            class="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 text-sm"
          >
            导出{{ selectedIds.size > 0 ? ` (${selectedIds.size})` : '' }}
          </button>
          <button
            @click="showImportForm = true"
            class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
          >
            导入
          </button>
          <button
            @click="startQrScan"
            class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
          >
            扫码添加
          </button>
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
      <div v-else class="space-y-4">
        <!-- 全选 -->
        <div class="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
          <input
            type="checkbox"
            :checked="selectedIds.size === accounts.length && accounts.length > 0"
            @change="toggleSelectAll"
            class="w-4 h-4 rounded"
          />
          <span class="text-sm text-gray-600">全选</span>
        </div>
        <!-- 分组显示 -->
        <div v-for="group in groupedAccounts" :key="group.issuer" class="space-y-2">
          <h3 class="text-sm font-medium text-gray-500 px-1">{{ group.issuer }}</h3>
          <div
            v-for="account in group.accounts"
            :key="account.id"
            class="flex items-center gap-3 p-3 bg-white rounded-lg shadow-sm"
          >
            <input
              type="checkbox"
              :checked="selectedIds.has(account.id)"
              @change="toggleSelect(account.id)"
              class="w-4 h-4 rounded"
            />
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="font-medium truncate">{{ account.name }}</span>
                <span
                  v-if="account.isPublic"
                  class="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded"
                >公开</span>
                <span
                  v-else
                  class="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded"
                >隐私</span>
              </div>
              <div class="text-sm text-gray-500 truncate">{{ account.secret }}</div>
            </div>
            <div class="flex gap-2 flex-shrink-0">
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
    </div>

    <!-- 导出弹窗 -->
    <div
      v-if="showExportForm"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      @mousedown.self="showExportForm = false"
    >
      <div class="bg-white rounded-lg p-6 w-full max-w-sm" @mousedown.stop>
        <h3 class="text-lg font-bold mb-4">导出账号</h3>
        <div class="space-y-4">
          <div>
            <p class="text-sm text-gray-600 mb-3">
              {{ selectedIds.size > 0 ? `将导出选中的 ${selectedIds.size} 个账号` : `将导出全部 ${accounts.length} 个账号` }}
            </p>
            <label class="block text-sm font-medium text-gray-700 mb-2">选择格式</label>
            <div class="flex gap-3">
              <label class="flex items-center gap-2">
                <input type="radio" v-model="exportFormat" value="tsv" class="w-4 h-4" />
                <span class="text-sm">TSV (Tab)</span>
              </label>
              <label class="flex items-center gap-2">
                <input type="radio" v-model="exportFormat" value="csv" class="w-4 h-4" />
                <span class="text-sm">CSV</span>
              </label>
              <label class="flex items-center gap-2">
                <input type="radio" v-model="exportFormat" value="txt" class="w-4 h-4" />
                <span class="text-sm">TXT</span>
              </label>
            </div>
          </div>
          <div class="flex gap-3 pt-2">
            <button
              @click="showExportForm = false"
              class="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              取消
            </button>
            <button
              @click="handleExport"
              class="flex-1 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              导出
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 导入弹窗 -->
    <div
      v-if="showImportForm"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      @mousedown.self="showImportForm = false; importError = ''"
    >
      <div class="bg-white rounded-lg p-6 w-full max-w-lg" @mousedown.stop>
        <h3 class="text-lg font-bold mb-4">批量导入账号</h3>
        <div class="space-y-4">
          <div class="text-sm text-gray-500 bg-gray-50 p-3 rounded">
            <p class="font-medium text-gray-700 mb-1">支持格式：</p>
            <p>name, issuer, secret（每行一条，逗号/Tab/竖线分隔）</p>
            <p class="text-xs text-gray-400 mt-1">自动跳过格式错误的行</p>
          </div>
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="block text-sm font-medium text-gray-700">粘贴内容或选择文件</label>
              <label class="cursor-pointer px-3 py-1 bg-gray-100 text-gray-600 rounded text-sm hover:bg-gray-200">
                选择文件
                <input
                  type="file"
                  accept=".txt,.csv,.tsv"
                  class="hidden"
                  @change="handleFileSelect"
                />
              </label>
            </div>
            <textarea
              v-model="importContent"
              rows="10"
              placeholder="示例：
user@example.com, Google, JBSWY3DPEHPK3PXP
admin@company.com, GitHub, HXDMVJECJJWSRB3H"
              class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs"
            ></textarea>
          </div>
          <div v-if="importError" class="text-red-500 text-sm">{{ importError }}</div>
          <div class="flex gap-3 pt-2">
            <button
              type="button"
              @click="showImportForm = false; importContent = ''; importError = ''"
              class="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              取消
            </button>
            <button
              @click="handleImport"
              :disabled="importLoading"
              class="flex-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {{ importLoading ? '导入中...' : '导入' }}
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
          <div>
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                v-model="form.isPublic"
                type="checkbox"
                class="w-4 h-4 rounded"
              />
              <span class="text-sm text-gray-700">公开显示（未登录时可见）</span>
            </label>
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

    <!-- 扫描二维码弹窗 -->
    <div
      v-if="showQrScanner"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      @mousedown.self="stopQrScan"
    >
      <div class="bg-white rounded-lg p-6 w-full max-w-md" @mousedown.stop>
        <h3 class="text-lg font-bold mb-4">扫描二维码</h3>
        <div class="space-y-4">
          <div id="qr-reader" class="w-full"></div>
          <div v-if="qrError" class="text-red-500 text-sm">{{ qrError }}</div>
          <div class="flex gap-3 pt-2">
            <button
              @click="stopQrScan"
              class="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              取消
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { Html5Qrcode } from 'html5-qrcode';
import {
  login,
  logout,
  getToken,
  getAdminAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
  importAccounts,
  exportAccounts,
  batchDeleteAccounts,
  batchSetVisibility,
  type Account,
} from '../utils/api';

const password = ref('');
const loginLoading = ref(false);
const loginError = ref('');
const isLoggedIn = ref(!!getToken());

const accounts = ref<Account[]>([]);
const loading = ref(true);
const selectedIds = ref<Set<string>>(new Set());

// 按 issuer 分组
const groupedAccounts = computed(() => {
  const groups: Record<string, Account[]> = {};
  for (const acc of accounts.value) {
    const issuer = acc.issuer || '其他';
    if (!groups[issuer]) {
      groups[issuer] = [];
    }
    groups[issuer].push(acc);
  }
  const sortedKeys = Object.keys(groups).sort((a, b) => {
    if (a === '其他') return 1;
    if (b === '其他') return -1;
    return a.localeCompare(b);
  });
  return sortedKeys.map((key) => ({
    issuer: key,
    accounts: groups[key].sort((a, b) => a.name.localeCompare(b.name)),
  }));
});

const showAddForm = ref(false);
const editingAccount = ref<Account | null>(null);
const form = ref({
  name: '',
  issuer: '',
  secret: '',
  isPublic: false,
});
const formLoading = ref(false);
const formError = ref('');

const showImportForm = ref(false);
const importContent = ref('');
const importLoading = ref(false);
const importError = ref('');

const showExportForm = ref(false);
const exportFormat = ref<'tsv' | 'csv' | 'txt'>('tsv');

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
    isPublic: account.isPublic ?? false,
  };
}

function closeForm() {
  showAddForm.value = false;
  editingAccount.value = null;
  form.value = { name: '', issuer: '', secret: '', isPublic: false };
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

async function handleImport() {
  if (!importContent.value.trim()) {
    importError.value = '请输入要导入的内容';
    return;
  }
  importLoading.value = true;
  importError.value = '';
  try {
    const result = await importAccounts(importContent.value);
    let msg = `成功导入 ${result.imported} 个账号`;
    if (result.skipped > 0) {
      msg += `\n跳过 ${result.skipped} 条无效数据`;
    }
    if (result.duplicates.length > 0) {
      msg += `\n\n以下账号已存在，已跳过：\n${result.duplicates.slice(0, 10).join('\n')}`;
      if (result.duplicates.length > 10) {
        msg += `\n...等 ${result.duplicates.length} 条`;
      }
    }
    alert(msg);
    showImportForm.value = false;
    importContent.value = '';
    await fetchAccounts();
  } catch (e) {
    importError.value = (e as Error).message;
  } finally {
    importLoading.value = false;
  }
}

function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement;
  if (!input.files?.length) return;

  const file = input.files[0];
  const reader = new FileReader();
  reader.onload = (e) => {
    importContent.value = e.target?.result as string || '';
  };
  reader.readAsText(file);
  input.value = '';
}

function toggleSelect(id: string) {
  const newSet = new Set(selectedIds.value);
  if (newSet.has(id)) {
    newSet.delete(id);
  } else {
    newSet.add(id);
  }
  selectedIds.value = newSet;
}

function toggleSelectAll() {
  if (selectedIds.value.size === accounts.value.length) {
    selectedIds.value = new Set();
  } else {
    selectedIds.value = new Set(accounts.value.map((a) => a.id));
  }
}

async function handleBatchDelete() {
  if (selectedIds.value.size === 0) return;
  if (!confirm(`确定要删除选中的 ${selectedIds.value.size} 个账号吗？`)) return;
  try {
    await batchDeleteAccounts(Array.from(selectedIds.value));
    selectedIds.value = new Set();
    await fetchAccounts();
  } catch (e) {
    alert((e as Error).message);
  }
}

async function handleBatchSetPublic(isPublic: boolean) {
  if (selectedIds.value.size === 0) return;
  const action = isPublic ? '公开' : '隐私';
  if (!confirm(`确定要将选中的 ${selectedIds.value.size} 个账号设为${action}吗？`)) return;
  try {
    await batchSetVisibility(Array.from(selectedIds.value), isPublic);
    selectedIds.value = new Set();
    await fetchAccounts();
  } catch (e) {
    alert((e as Error).message);
  }
}

async function handleExport() {
  try {
    const result = await exportAccounts();
    const idsToExport = selectedIds.value.size > 0 ? selectedIds.value : new Set(accounts.value.map((a) => a.id));
    const accountsToExport = result.accounts.filter((a) => idsToExport.has(a.id));

    let separator = '\t';
    let ext = 'tsv';
    let mimeType = 'text/tab-separated-values';

    if (exportFormat.value === 'csv') {
      separator = ',';
      ext = 'csv';
      mimeType = 'text/csv';
    } else if (exportFormat.value === 'txt') {
      separator = ' | ';
      ext = 'txt';
      mimeType = 'text/plain';
    }

    const header = ['No', 'name', 'issuer', 'secret', 'isPublic'].join(separator);
    const rows = accountsToExport.map((acc, index) =>
      [index + 1, acc.name, acc.issuer, acc.secret, acc.isPublic ? 'true' : 'false'].join(separator)
    );
    const content = [header, ...rows].join('\n');

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `2fa-backup-${new Date().toISOString().slice(0, 10)}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    showExportForm.value = false;
  } catch (e) {
    alert((e as Error).message);
  }
}

// 二维码扫描相关
const showQrScanner = ref(false);
const qrError = ref('');
let html5QrCode: Html5Qrcode | null = null;

function parseOtpauthUri(uri: string): { name: string; issuer: string; secret: string } | null {
  try {
    // otpauth://totp/Label?secret=XXX&issuer=YYY
    const url = new URL(uri);
    if (url.protocol !== 'otpauth:') return null;

    const params = url.searchParams;
    const secret = params.get('secret');
    if (!secret) return null;

    // Label 可能是 issuer:account 或者只是 account
    const label = decodeURIComponent(url.pathname.replace(/^\/+/, '').replace(/^totp\//, ''));
    let issuer = params.get('issuer') || '';
    let name = label;

    if (label.includes(':')) {
      const parts = label.split(':');
      if (!issuer) issuer = parts[0];
      name = parts.slice(1).join(':');
    }

    return { name, issuer, secret: secret.toUpperCase() };
  } catch {
    return null;
  }
}

async function startQrScan() {
  showQrScanner.value = true;
  qrError.value = '';

  await nextTick();

  try {
    html5QrCode = new Html5Qrcode('qr-reader');
    await html5QrCode.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      async (decodedText) => {
        const parsed = parseOtpauthUri(decodedText);
        if (parsed) {
          await stopQrScan();
          form.value = {
            name: parsed.name,
            issuer: parsed.issuer,
            secret: parsed.secret,
            isPublic: false,
          };
          showAddForm.value = true;
        } else {
          qrError.value = '无效的二维码格式';
        }
      },
      () => {} // 忽略扫描中的错误
    );
  } catch (err) {
    qrError.value = '无法访问摄像头，请检查权限设置';
  }
}

async function stopQrScan() {
  if (html5QrCode) {
    try {
      await html5QrCode.stop();
    } catch {
      // 忽略停止错误
    }
    html5QrCode = null;
  }
  showQrScanner.value = false;
  qrError.value = '';
}

onMounted(() => {
  if (isLoggedIn.value) {
    fetchAccounts();
  } else {
    loading.value = false;
  }
});

onUnmounted(() => {
  stopQrScan();
});
</script>
