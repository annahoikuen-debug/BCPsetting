-- 005: companies の NOT NULL 列にデフォルト値を設定
--
-- WHY: サインアップ時点では業種・従業員数が未確定のため、name のみの
-- INSERT が NOT NULL 違反で失敗していた。ウィザード Step 1 の保存時に
-- 上書きされる前提のプレースホルダー値をデフォルトとして設定する。

alter table public.companies
  alter column industry set default 'その他';

alter table public.companies
  alter column employee_scale set default '10-49名';
