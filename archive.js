// archive.js
// アーカイブ一覧・再編集・削除機能

document.addEventListener('DOMContentLoaded', () => {
    const archiveList = document.getElementById('archive-list');
    renderArchiveList();

    function renderArchiveList() {
        const articles = getAllArticles();
        archiveList.innerHTML = '';
        if (articles.length === 0) {
            archiveList.innerHTML = '<p>保存された記事はありません。</p>';
            return;
        }
        const table = document.createElement('table');
        table.className = 'archive-table';
        table.innerHTML = `
            <thead>
                <tr>
                    <th>タイトル</th>
                    <th>作成日</th>
                    <th>操作</th>
                </tr>
            </thead>
            <tbody>
                ${articles.map(article => `
                    <tr>
                        <td><a href="blog/${escapeHtml(article.slug||article.id)}.html" target="_blank">${escapeHtml(article.title)}</a></td>
                        <td>${article.createdAt ? new Date(article.createdAt).toLocaleString() : ''}</td>
                        <td>
                            <button class="btn-edit" data-id="${article.id}">再編集</button>
                            <button class="btn-delete" data-id="${article.id}">削除</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        `;
        archiveList.appendChild(table);

        // イベントバインド
        table.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = btn.getAttribute('data-id');
                editArticle(id);
            });
        });
        table.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = btn.getAttribute('data-id');
                if (confirm('本当に削除しますか？')) {
                    deleteArticle(id);
                    renderArchiveList();
                }
            });
        });
    }

    function getAllArticles() {
        const items = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('blog-article-')) {
                try {
                    const data = JSON.parse(localStorage.getItem(key));
                    if (data && data.id) items.push(data);
                } catch {}
            }
        }
        // 新しい順に
        return items.sort((a, b) => b.createdAt - a.createdAt);
    }

    function editArticle(id) {
        // 編集ページへ遷移（content-manager.html）
        localStorage.setItem('edit-article-id', id);
        window.location.href = 'content-manager.html?edit=1';
    }

    function deleteArticle(id) {
        localStorage.removeItem('blog-article-' + id);
    }

    function escapeHtml(str) {
        return str.replace(/[&<>'"]/g, tag => ({'&':'&amp;','<':'&lt;','>':'&gt;','\'':'&#39;','"':'&quot;'}[tag]));
    }
});
