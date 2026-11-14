package com.kawaii.studybuddy;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;
import java.io.File;
import java.io.FileNotFoundException;

/** Narrow, grant-only camera output provider; never exposes general filesystem paths. */
public final class CameraFileProvider extends ContentProvider {
    @Override public boolean onCreate() { return true; }

    private File photo(Uri uri) throws FileNotFoundException {
        String name = uri.getLastPathSegment();
        if (uri.getPathSegments().size() != 1 || name == null || !name.matches("capture-[0-9]+\\.jpg"))
            throw new FileNotFoundException("Invalid photo URI");
        File file = new File(new File(getContext().getCacheDir(), "camera"), name);
        if (!file.isFile()) throw new FileNotFoundException("Photo unavailable");
        return file;
    }

    @Override public String getType(Uri uri) { return "image/jpeg"; }

    @Override public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        int flags;
        if (mode.equals("r")) flags = ParcelFileDescriptor.MODE_READ_ONLY;
        else if (mode.equals("w") || mode.equals("wt")) flags = ParcelFileDescriptor.MODE_WRITE_ONLY | ParcelFileDescriptor.MODE_TRUNCATE;
        else if (mode.equals("rw") || mode.equals("rwt")) flags = ParcelFileDescriptor.MODE_READ_WRITE
            | (mode.equals("rwt") ? ParcelFileDescriptor.MODE_TRUNCATE : 0);
        else throw new FileNotFoundException("Unsupported mode");
        return ParcelFileDescriptor.open(photo(uri), flags);
    }

    @Override public Cursor query(Uri uri, String[] projection, String selection, String[] args, String sort) {
        try {
            File file = photo(uri);
            String[] columns = projection == null ? new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE} : projection;
            MatrixCursor cursor = new MatrixCursor(columns, 1);
            Object[] values = new Object[columns.length];
            for (int i = 0; i < columns.length; i++) {
                if (OpenableColumns.DISPLAY_NAME.equals(columns[i])) values[i] = file.getName();
                if (OpenableColumns.SIZE.equals(columns[i])) values[i] = file.length();
            }
            cursor.addRow(values);
            return cursor;
        } catch (FileNotFoundException ignored) { return null; }
    }

    @Override public Uri insert(Uri uri, ContentValues values) { throw new UnsupportedOperationException(); }
    @Override public int update(Uri uri, ContentValues values, String where, String[] args) { throw new UnsupportedOperationException(); }
    @Override public int delete(Uri uri, String where, String[] args) { throw new UnsupportedOperationException(); }
}
