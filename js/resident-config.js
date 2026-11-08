/* 편집 지점: 질문 문구, 데모 세대별 시설자료. 실제 확인 자료로 교체하세요.
   키는 건물 ID → 호수. 다른 호수/동의 시설은 추정하거나 상속하지 않습니다. */
window.RESIDENT_DESIGN = {
  facilities: {
    'happy-101': {
      '501': { source: '디자인 검토용 예시 자료', verifiedAt: '2026-10-18', core: { inUnitShelter: false, downwardEvacuationHatch: true, lightPartition: false } },
      '502': { source: '디자인 검토용 예시 자료', verifiedAt: '2026-10-18', core: { inUnitShelter: true, downwardEvacuationHatch: false, lightPartition: false } }
    }
  },
  questions: [
    { id: 'q1', label: '화재 위치', title: '불이 난 곳은\n어디인가요?', hint: '지금 내가 있는 층을 기준으로 선택하세요.', options: [['우리집','우리 집','home'],['같은층','같은 층','layers'],['아래층','아래층','down'],['위층','위층','up'],['모름','모르겠어요','help']] },
    { id: 'q2', label: '실내 상태', title: '집 안으로 연기나\n화염이 들어오나요?', hint: '현재 집 안의 상태를 선택하세요.', options: [['없음','연기 없음','wind'],['조금있음','연기 조금 있음','cloud'],['많음','연기 많음','cloud'],['화염','집 안으로 화염 들어옴','flame'],['모르겠음','모르겠어요','help']] },
    { id: 'q3', label: '현관 상태', title: '현관으로\n나갈 수 있나요?', hint: '확인하려고 위험한 문을 열거나 만지지 마세요.', options: [['가능하다','나갈 수 있어요','door'],['문밖연기있음','문밖에 연기가 있어요','cloud'],['문밖화염있음','문밖에 화염이 있어요','flame'],['막힘','문이 뜨겁거나 열 수 없어요','lock'],['모르겠다','모르겠어요','help']] },
    { id: 'q4', label: '이동 경로', title: '복도와 계단에\n연기나 화염이 있나요?', hint: '이미 알고 있는 상태만 답해주세요. 확인하러 이동하지 마세요.', options: [['지상안전','없고, 지상까지 이동 가능해요','stairs'],['위험','연기나 화염이 있어요','cloud'],['모름','모르겠어요','help']] }
  ]
};
// null이면 결과, 숫자이면 다음 질문 인덱스. 화면과 회귀검사가 같은 분기를 사용합니다.
window.RESIDENT_DESIGN.nextQuestionIndex=function(index,answers){
 if(index===0&&answers.q1==='우리집')return 2;
 if(index===1&&answers.q2==='없음'&&['같은층','아래층','위층'].includes(answers.q1))return null;
 if(index===2&&answers.q3!=='가능하다')return null;
 return index>=3?null:index+1;
};
