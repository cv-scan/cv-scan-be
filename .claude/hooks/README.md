# Claude Hooks

Thư mục này chứa các hook script chạy tự động trước/sau khi Claude thực hiện hành động.

## Hooks có thể cấu hình

### pre-edit
Chạy trước khi Claude sửa file. Dùng để:
- Kiểm tra file có đang được edit bởi người khác không
- Backup file trước khi sửa

### post-edit
Chạy sau khi Claude sửa file. Dùng để:
- Tự động chạy `npm run typecheck` sau khi sửa `.ts` file
- Tự động chạy `npm run lint` để format code

### pre-bash
Chạy trước khi Claude thực thi bash command. Dùng để:
- Chặn các lệnh nguy hiểm (rm -rf, git push --force)
- Log mọi command ra audit file

## Cách thêm hook

Tạo file script trong thư mục này và cấu hình trong `.claude/settings.json`:

```json
{
  "hooks": {
    "post-edit": ".claude/hooks/post-edit.sh"
  }
}
```
