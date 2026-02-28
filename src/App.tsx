import React, { useState, useCallback, useEffect } from 'react';
import { Toolbar } from './components/Toolbar';
import { Grid } from './components/Grid';
import { useGrid } from './hooks/useGrid';
import { gridToJson, jsonToGrid, saveFile, openFileDialog } from './utils/fileIO';
import { exportToSVG } from './utils/exportSVG';
import { exportToPDF } from './utils/exportPDF';
import { computeAutoColWidths, computeAutoRowHeights } from './utils/autoFit';

type Theme = 'dark' | 'light';

function App() {
  const [title, setTitle] = useState('Untitled');
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  }, []);
  const {
    grid,
    getCell,
    setCell,
    moveCell,
    getRowHeight,
    getColWidth,
    setRowHeight,
    setColWidth,
    setAllColWidths,
    setAllRowHeights,
    setCellColors,
    insertRow,
    deleteRow,
    insertCol,
    deleteCol,
    loadGrid,
    clearGrid,
  } = useGrid();

  const handleNew = useCallback(() => {
    if (confirm('Start a new document? Unsaved changes will be lost.')) {
      clearGrid();
      setTitle('Untitled');
    }
  }, [clearGrid]);

  const handleSave = useCallback(() => {
    const json = gridToJson(grid, title);
    saveFile(json, `${title || 'texel'}.texel`, 'application/json');
  }, [grid, title]);

  const handleLoad = useCallback(async () => {
    try {
      const raw = await openFileDialog();
      const file = jsonToGrid(raw);
      loadGrid(file.grid);
      setTitle(file.metadata.title || 'Untitled');
    } catch (e) {
      alert('Failed to open file: ' + (e as Error).message);
    }
  }, [loadGrid]);

  const handleExportSVG = useCallback(() => {
    exportToSVG(grid, title || 'texel');
  }, [grid, title]);

  const handleExportPDF = useCallback(() => {
    exportToPDF(grid, title || 'texel');
  }, [grid, title]);

  const handleAutoFit = useCallback(() => {
    const newColWidths = computeAutoColWidths(grid);
    // Use the freshly computed widths (not yet in state) for row height measurement
    const mergedColWidths = { ...grid.colWidths, ...newColWidths };
    const newRowHeights = computeAutoRowHeights(grid, mergedColWidths);
    setAllColWidths(newColWidths);
    setAllRowHeights(newRowHeights);
  }, [grid, setAllColWidths, setAllRowHeights]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
      }}
    >
      <Toolbar
        title={title}
        onTitleChange={setTitle}
        onNew={handleNew}
        onSave={handleSave}
        onLoad={handleLoad}
        onExportSVG={handleExportSVG}
        onExportPDF={handleExportPDF}
        onAutoFit={handleAutoFit}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      <Grid
        numRows={grid.numRows}
        numCols={grid.numCols}
        getCell={getCell}
        setCell={setCell}
        moveCell={moveCell}
        getRowHeight={getRowHeight}
        getColWidth={getColWidth}
        setRowHeight={setRowHeight}
        setColWidth={setColWidth}
        setCellColors={setCellColors}
        insertRow={insertRow}
        deleteRow={deleteRow}
        insertCol={insertCol}
        deleteCol={deleteCol}
      />
    </div>
  );
}

export default App;
