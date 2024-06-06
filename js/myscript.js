$.fn.dragCheckbox = function () {
    var source = this;
    var ConditionA = false;
    var ConditionB = false;
    source.parent().css({
        '-webkit-user-select': 'none',
        '-moz-user-select': 'none',
        '-ms-user-select': 'none',
        '-o-user-select': 'none',
        'user-select': 'none'
    });
    source.mousedown(function () {
        ConditionA = true;
        ConditionB = true;
    });
    $(document).mouseup(function () {
        ConditionA = false;
        ConditionB = false;
    })
    source.mouseenter(function () {
        if (ConditionA != false) {
            $(this).trigger('click');
        }
    });
    source.mouseout(function () {
        if (ConditionA != false && ConditionB != false) {
            $(this).trigger('click');
            ConditionB = false;
        }
    });
}

$.fn.setNavigation = function () {
    const naviInfo = this;

    fetch('data/navi_data.json')
        .then(response => response.json()) // JSON으로 파싱
        .then(data => {
            for (i in data) {
                naviInfo.append(`<li><a href="${data[i].url}" class="nav-link px-2 text-white">${data[i].name}</a></li>`);
            }
        })
        .catch(error => {
            console.error('Error loading JSON:', error);
        });
}

$(document).ready(function () {
    const cart_copn_aply_rstr_amnt = 30000
    const optCheck = $("input[name='optCheck']");
    //토스트
    const toastBootstrap = bootstrap.Toast.getOrCreateInstance($("#broken"))
    let toastBody = $(".toast-body");

    $("#my-navi").setNavigation();

    //Calculator Init
    (() => {
        allCheckboxController();
        setTotal();
        setRefundCalculator();
    })();

    //체크박스 드래그
    optCheck.dragCheckbox();

    //전체 체크하기
    $("#allCheck").on("click", function () {
        const isAll = $("#allCheck").is(":checked");
        optCheck.prop("checked", isAll);
    });

    //귀책 사유 구분
    $("input[name='cs_dvsn']").on("click", function () {
        setRefundCalculator();
    });

    //갯수 선택
    $(".optCnt").on("change", function () {
        const optCnt = $(this).closest('tr').find("input");
        const isEqual = (a, b) => a && (a === b);
        optCnt.data("cnt", parseInt(this.value));

        $("input[name='optCheck']:checked").each(function () {
            if (optCnt.val() === $(this).val() && optCnt.data("ovalue") === $(this).data("ovalue")) {
                if (isEqual(optCnt.data("oitemno"), $(this).data("oitemno"))) {
                    return true;
                }
                $(this).prop("checked", false);
                $("#allCheck").prop("checked", false);
            }
        })
        setRefundCalculator();
    })

    //옵션 체크박스 선택하면
    $(".optCheck").on("change", function () {
        allCheckboxController();
        setRefundCalculator();
    })

    //수기계산
    $(".calculator, #one_dprice, #return_dprice").on("input", function () {
        this.value = regNumber(this.value);
        // console.log(this.id, this.value);
        sumRefundCalculator();
    })

    //상품 취소 버튼
    $("#btn-cancel").click(function () {
        //체크박스 확인
        allCheckboxController();
        if (!optCheck.is(":checked")) {
            alert('선택된 상품이 없습니다.');
            return false;
        }
        //환불금액
        const repay = $("#repay").val() || 0;
        if (parseInt(repay) < 1) {
            alert('환불액을 확인 하십시오.');
            return false;
        }
        //잔액
        const balance_amnt = $("#balance_amnt").val() || 0;
        if (parseInt(balance_amnt) < 0) {
            alert('환불 시 잔액을 확인 하십시오.');
            return false;
        }

        //취소 타입
        let type = $("#allCheck").prop("checked") ? "all" : "opt";

        //선택 상품 수집
        let items = [];
        let dprice_check = true;
        $("input[name='optCheck']:checked").each(function () {
            const is_dprice = parseInt($(this).data("dprice")) > 0;
            if ($(this).data("step2") === "4S" && !is_dprice || $(this).data("refund_yn") === "Y") {
                return true; //continue
            }

            if (type === "dprice" && !is_dprice) {
                dprice_check = false;
                return false; //break
            }
            items.push({
                "order_sno": $(this).val(),
                "po_idx": $(this).data("po_idx"),
                "oitemno": $(this).data("oitemno"),
                "cancelcnt": $(this).closest('tr').find('select').val(),
                "is_cnt": $(this).data("is_cnt"),
                "is_dprice": is_dprice,
                "step2": $(this).data("step2"),
                "recopn": false,
            })
        })

        if (!dprice_check) {
            alert("배송비만 체크해주세요. 환불 금액이 일치하지 않습니다.");
            return false;
        }

        //차감금액
        let cprice = parseInt($("#cprice").val()) || 0;

        if (!confirm('상품을 취소 하시겠습니까?')) {
            return false;
        }

        if (cprice > 0) {
            if (!confirm("차감금액이 입력 되었습니다.\n차감금액 " + cprice + "원을 제외 하고 " + repay + "원을 취소 하시겠습니까?")) {
                return false;
            }
        }

        //items 체크
        if (items.length < 1) {
            alert("취소할 수 있는 상품이 없습니다.");
            return false;
        }

        alert("정상 취소 입니다.");
    });

    //금액 셋팅
    function setRefundCalculator() {
        let tprice = 0;
        let gprice = 0;
        let copn_amnt = 0;
        let cart_copn_amnt = 0;
        let rsmn_use_amnt = 0;
        let dprice = 0;
        let cprice = 0;

        let cartCopn_gprice = 0;
        let cartCopn_copn_amnt = 0;
        let cartCopn_cart_copn_amnt = 0;

        let cartCopn_isCnt = false;

        //체크된 금액 계산
        $("input[name='optCheck']:checked").each(function () {
            let cnt = $(this).data("cnt");
            let originCnt = $(this).data("origin_cnt");
            let maxCnt = $(this).data("max_cnt");
            let isCnt = cnt < 0 ? false : originCnt > cnt;
            if (!cartCopn_isCnt && isCnt) {
                cartCopn_isCnt = isCnt;
            }

            $(this).data("is_cnt", isCnt);
            tprice += $(this).data("tprice");
            gprice += isCnt ? $(this).data("uprice") * cnt : $(this).data("gprice");
            copn_amnt += isCnt ? $(this).data("copn_unit_amnt") * cnt : $(this).data("copn_amnt");
            cart_copn_amnt += isCnt ? $(this).data("cart_copn_unit_amnt") * cnt : $(this).data("cart_copn_amnt");
            rsmn_use_amnt += isCnt ? $(this).data("rsmn_unit_amnt") * cnt : $(this).data("rsmn_use_amnt");
            dprice += $(this).data("dprice");
            cprice += $(this).data("cprice");

            //옵션 개수 취소일때 장바구니쿠폰 남은 금액 계산
            if ($(this).data("cart_copn") === 1 && isCnt) {
                cartCopn_gprice += $(this).data("gprice") - $(this).data("uprice") * cnt;
                cartCopn_copn_amnt += $(this).data("copn_amnt") - $(this).data("copn_unit_amnt") * cnt;
                cartCopn_cart_copn_amnt += $(this).data("cart_copn_amnt") - $(this).data("cart_copn_unit_amnt") * cnt;
            }

            //나누어떨어지지 않을때
            if (originCnt > maxCnt && maxCnt === cnt && isCnt) {
                console.log('마지막 남은 옵션 수량 취소');
                copn_amnt += $(this).data("copn_amnt") - $(this).data("copn_unit_amnt") * originCnt;
                cart_copn_amnt += $(this).data("cart_copn_amnt") - $(this).data("cart_copn_unit_amnt") * originCnt;
                rsmn_use_amnt += $(this).data("rsmn_use_amnt") - $(this).data("rsmn_unit_amnt") * originCnt;
            }
        })

        //장바구니 쿠폰 남은 상품 금액 계산
        $("input[name='optCheck'][data-cart_copn='1'][data-refund_yn='N']:not(:checked)").each(function () {
            cartCopn_gprice += $(this).data("gprice");
            cartCopn_copn_amnt += $(this).data("copn_amnt");
            cartCopn_cart_copn_amnt += $(this).data("cart_copn_amnt");
        })

        toastBody.text("일반취소");
        const cartCopn_amnt = cartCopn_gprice - cartCopn_copn_amnt;
        const cs_dvsn = $("input[name='cs_dvsn']:checked").val();
        const check_cnt = $("input[name='optCheck']:checked").length;
        if (cartCopn_amnt > 0) {
            //장바구니쿠폰 금액 미달 && 구매자 귀책일때만 && 옵션 수량 취소가 포함되지 않을때
            if (cartCopn_amnt < cart_copn_aply_rstr_amnt && cs_dvsn === '0' && !cartCopn_isCnt) {
                toastBody.text("장바구니 쿠폰 사용 조건 부합");
                cart_copn_amnt += cartCopn_cart_copn_amnt;

                //환불 금액이 0,마이너스면 상품쿠폰처럼
                if (check_cnt > 0 && gprice - copn_amnt - cart_copn_amnt - rsmn_use_amnt < 1) {
                    toastBody.text("마이너스금액 일반취소");
                    cart_copn_amnt = cart_copn_amnt - cartCopn_cart_copn_amnt
                }
            }
        }

        if (check_cnt > 0) {
            toastBootstrap.show();
        }

        $("#re_tprice").val(tprice);
        $("#re_opt_amnt").val(gprice);                                      //환불옵션금액
        $("#re_copn_amnt").val(copn_amnt);                                  //반환상품쿠폰
        $("#re_cart_copn_amnt").val(cart_copn_amnt);                        //반환장바구니쿠폰
        $("#re_rsmn_amnt").val(rsmn_use_amnt);                              //반환적립금
        $("#re_dprice").val(dprice);                                        //반환배송비

        sumRefundCalculator();
    }

    //금액 계산
    function sumRefundCalculator() {
        const tprice = parseInt($("#re_tprice").val() || 0);                   //환불옵션금액
        const gprice = parseInt($("#re_opt_amnt").val() || 0);                 //환불옵션금액
        const copn_amnt = parseInt($("#re_copn_amnt").val() || 0);             //반환상품쿠폰
        const cart_copn_amnt = parseInt($("#re_cart_copn_amnt").val() || 0);   //반환장바구니쿠폰
        const rsmn_use_amnt = parseInt($("#re_rsmn_amnt").val() || 0);         //반환적립금
        const dprice = parseInt($("#re_dprice").val() || 0);                   //환불배송비
        const one_dprice = parseInt($("#one_dprice").val() || 0);              //고객부담 원배송비
        const return_dprice = parseInt($("#return_dprice").val() || 0);        //고객부담 회수배송비
        const total_amnt = parseInt($("#total_amnt").val() || 0);              //총 주문금액

        //환불주문금액
        const refund_amnt = gprice - copn_amnt - cart_copn_amnt - rsmn_use_amnt;
        $("#refund_amnt").val(refund_amnt);

        //실제환불금액
        const repay = refund_amnt + dprice - one_dprice - return_dprice;
        $(".repay").val(repay);

        //환불 시 잔액
        const balance_amnt = total_amnt - repay;
        $("#balance_amnt").val(isNaN(balance_amnt) ? 0 : balance_amnt);

        //차감금액
        const cprice = one_dprice + return_dprice;
        $("#cprice").val(isNaN(cprice) ? 0 : cprice);

    }

    //전체체크박스 컨트롤
    function allCheckboxController() {
        const notChecked = optCheck.not(":checked");
        $("#allCheck").prop("checked", !notChecked.length);
    }

    //전체 금액
    function setTotal() {
        let total_price = 0
        optCheck.each(function () {
            total_price += $(this).data("gprice") - $(this).data("copn_amnt") - $(this).data("cart_copn_amnt") - $(this).data("rsmn_use_amnt") + $(this).data("dprice")
        })
        $("#total_amnt").val(total_price)
    }
    //숫자만
    const regNumber = (value) => {
        return value.replace(/[^0-9]/g, '');
    }
});