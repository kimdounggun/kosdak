import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

/**
 * JWT가 있으면 검증 후 req.user 설정, 없어도 통과 (req.user = undefined).
 * 비로그인으로 모든 기능 사용 가능하게 하기 위한 선택 인증 가드.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    return super.canActivate(context) as Observable<boolean>;
  }

  handleRequest<TUser = any>(err: any, user: TUser | false): TUser | undefined {
    if (err || user === false) {
      return undefined;
    }
    return user as TUser;
  }
}
