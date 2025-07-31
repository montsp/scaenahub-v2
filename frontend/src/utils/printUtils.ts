// 印刷ユーティリティ関数

export const setupPrintStyles = () => {
  // 印刷時のスタイル調整
  const printStyleSheet = document.createElement('style');
  printStyleSheet.textContent = `
    @media print {
      .script-header {
        display: block !important;
      }
      
      .page-number {
        display: block !important;
      }
    }
  `;
  document.head.appendChild(printStyleSheet);
};

export const handlePrint = () => {
  // 印刷前の処理
  const printElements = document.querySelectorAll('.script-header, .page-number');
  printElements.forEach(el => {
    (el as HTMLElement).style.display = 'block';
  });

  // 印刷実行
  window.print();

  // 印刷後の処理
  setTimeout(() => {
    printElements.forEach(el => {
      (el as HTMLElement).style.display = 'none';
    });
  }, 1000);
};

export const optimizeForPrint = () => {
  // 印刷最適化のための処理
  const tables = document.querySelectorAll('.script-table');
  tables.forEach(table => {
    // テーブルの改ページ制御
    const rows = table.querySelectorAll('tr');
    rows.forEach((row, index) => {
      if (index > 0 && index % 25 === 0) {
        // 25行ごとに改ページを推奨
        (row as HTMLElement).style.pageBreakBefore = 'auto';
      }
    });
  });
};

// 印刷時のイベントリスナー
export const setupPrintEventListeners = () => {
  window.addEventListener('beforeprint', () => {
    setupPrintStyles();
    optimizeForPrint();
  });

  window.addEventListener('afterprint', () => {
    // 印刷後のクリーンアップ
    console.log('Print completed');
  });
};