for (var i = 0; i < $(".btn-group").length; i++) {
	for (var j = 0; j < $(".btn-group").eq(i).find("button").length; j++) {
		var target = $(".btn-group").eq(i).find("button").eq(j);
		target.attr("i", i);
		target.attr("j", j);
		target.mouseover(function(event) {
			$("#help").html(helpArray[$(event.target).attr("i")][$(event.target).attr("j")]);
		});
		target.mouseout(function(event) {
			$("#help").html("欢迎使用米米弹幕");
		});
		target.click(function(event) {
			changeOption($(event.target).attr("i"), $(event.target).attr("j"));
		});
	}
}

function changeOption(i, j) {
	i = parseInt(i);
	j = parseInt(j);
	var target = $(".btn-group").eq(i).find("button");
	target.removeClass("active");
	target.eq(j).addClass("active");
	options[i] = j;
	if (i == 0) {
		$(".row").eq(!j + 2).hide();
		$(".row").eq(j + 2).show();
	}
}

function panelSubmit(event) {
	if (mainWindow) {
		$("#submit").html("开启弹幕窗口");
		$("#submit").removeClass("btn-danger");
		$("#submit").addClass("btn-primary");
		closeWindow();
	}
	else {
		$("#submit").html("关闭弹幕窗口");
		$("#submit").removeClass("btn-primary");
		$("#submit").addClass("btn-danger");
		createWindow();
	}
}

function about() {
	alert("We are using Node.js" + process.versions.node + ", Chromium" + process.versions.chrome + ", and Electron" + process.versions.electron + ". Powered by Mimi.");
}
